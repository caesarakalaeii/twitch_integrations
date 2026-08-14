{
  # Keep this line accurate and one line long: `nix flake metadata` prints it,
  # and it is the first thing a cold agent learns about the repo.
  description = "twitch_integrations -- Node/TypeScript service turning Twitch EventSub events into Arduino commands and a credits screen. Run `nix flake show` for the command map.";

  # nixpkgs is the only input, on purpose.
  #
  # flake-utils would buy exactly one thing here -- eachDefaultSystem -- which is
  # the three-line genAttrs below. In exchange it costs a second lock node in
  # every repo (flake-utils transitively pulls `systems`, so really two), a
  # second upstream that can break one repo and not the other forty, and a
  # hardcoded system list this repo cannot edit. That list is currently broken:
  # it still contains x86_64-darwin, which now throws (see `systems` below).
  #
  # nixos-unstable is the same channel the author's own NixOS config tracks, so
  # `nix develop` here and `nixos-rebuild` there resolve the same store paths and
  # share one cache.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    # `...` rather than a closed { self, nixpkgs }: adding a second input later
    # would otherwise fail with "called with unexpected argument 'self'".
    { nixpkgs, ... }:
    let
      lib = nixpkgs.lib;

      # x86_64-darwin is deliberately absent. nixpkgs 26.11 replaced that whole
      # attribute set with `throw "Nixpkgs 26.11 has dropped support for
      # x86_64-darwin"`. genAttrs is lazy, so plain `nix develop` on Linux would
      # not notice -- it detonates later, on `nix flake check --all-systems`.
      #
      # The darwin entry here means "this flake evaluates on darwin", NOT "this
      # repo runs there": `npm ci` compiles `epoll` (pulled in by `onoff`, the
      # GPIO library), and epoll is a Linux-only syscall interface. The shell is
      # usable on a Mac for editing and `dev-lint`; expect `dev-setup` to fail.
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      # Stand-in for flake-utils.lib.eachDefaultSystem. Passes `pkgs` rather than
      # a system string, because that is what every call site below wants.
      forAllSystems = f: lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # ======================================================================
      # PER-REPO BLOCK 1 -- the toolchain
      # ======================================================================
      # Everything the commands below need. `nix flake check` realises this
      # closure, so a typo'd attr name fails at the flake gate instead of
      # surfacing as "command not found" halfway through a task.
      #
      # Explicit `pkgs.foo`, never `with pkgs; [ ... ]`: when an attr disappears
      # in a nixpkgs bump, `with` reports a bare undefined identifier with no
      # hint of which set it came from, and the name is not greppable.
      #
      # Pin language runtimes by MAJOR, never by rolling alias -- an alias that
      # moves under you invalidates every node_modules in the fleet on the same
      # afternoon.
      toolchain = pkgs: [
        # npm ships inside the nodejs derivation -- never add it separately.
        # package-lock.json (lockfileVersion 3) is the committed lockfile, so npm
        # is the package manager here; do not add pnpm or yarn beside it.
        pkgs.nodejs_22

        # The repo pins typescript 4.9.5 in devDependencies and `npm run build`
        # calls `npm exec tsc`, so the BUILD uses the repo's own compiler. This
        # store copy (5.x) is here only for ad-hoc `tsc --noEmit` style probing.
        pkgs.typescript

        # Load-bearing runtime dependency, not a nicety: src/eventsub.ts does
        # `spawn('yt-dlp', ...)` to download clips, resolved from PATH.
        pkgs.yt-dlp

        # node-gyp toolchain. Two dependencies build C++ at install time:
        # `epoll` (via onoff) always compiles from source, and `bcrypt` falls
        # back to compiling when node-pre-gyp finds no matching prebuild.
        #
        # stdenv.cc is listed even though mkShell already puts a compiler on PATH,
        # and removing it is a trap: the `dev-*` wrappers get ONLY this list, no
        # stdenv, so `nix run .#setup` without it dies inside node-gyp with
        # `make: c++: No such file or directory` / `Error 127` while
        # `nix develop -c dev-setup` succeeds. Same command, two behaviours --
        # exactly what the shared toolchain list exists to prevent. It is the
        # wrapped cc rather than pkgs.gcc so both surfaces use the compiler
        # mkShell would have used anyway.
        pkgs.stdenv.cc

        # Do not trust `python3` on PATH to be THIS python: yt-dlp above
        # propagates python3-3.14, which lands earlier and wins, so
        # `python3 --version` in this shell reports 3.14 while node-gyp is pinned
        # to 3.13 through npm_config_python below. mkShell never warns about that
        # kind of shadowing. Keep the explicit env var rather than reordering the
        # list -- PATH order between propagated inputs is not something a repo
        # should be relying on.
        pkgs.python313
        pkgs.pkg-config

        # ---- present in every repo in the fleet ----
        pkgs.git
        pkgs.jq
        pkgs.gnumake
      ];

      # ======================================================================
      # PER-REPO BLOCK 2 -- libraries that get dlopened, not linked
      # ======================================================================
      # Empty on purpose, and this was measured rather than assumed. The one
      # native addon this repo actually loads is bcrypt, and node-pre-gyp fetches
      # it as a prebuild with no RUNPATH at all
      # (`readelf -d lib/binding/napi-v3/bcrypt_lib.node` lists NEEDED
      # libstdc++.so.6 / libgcc_s.so.1 and no RPATH) -- yet
      # `LD_LIBRARY_PATH= node -e 'require("bcrypt")'` still loads it, because the
      # nix `node` binary has already pulled libstdc++ and libgcc_s into the
      # process by the time the addon is dlopened.
      #
      # So an LD_LIBRARY_PATH export here would be cargo cult, and the generic
      # machinery below skips the export entirely while this list is empty,
      # leaving the ambient value untouched. Add the specific library back (most
      # likely pkgs.stdenv.cc.cc.lib) only when a NEW dependency's prebuild fails
      # with "cannot open shared object file" -- sharp/libvips, canvas and
      # better-sqlite3 are the usual culprits.
      nativeLibs = pkgs: [ ];

      # ======================================================================
      # PER-REPO BLOCK 3 -- constant environment variables
      # ======================================================================
      # Only values that are constants belong here. Anything that must READ an
      # existing value (LD_LIBRARY_PATH), UNSET something (SOURCE_DATE_EPOCH) or
      # touch the work tree goes in the shellHook further down.
      #
      # This attrset is applied to BOTH surfaces -- the dev shell and every
      # `nix run` wrapper -- so a command cannot behave differently depending on
      # how it was invoked.
      envVars = pkgs: {
        # Point node-gyp at the headers that ship inside this exact nodejs
        # derivation. Without it node-gyp downloads a header tarball from
        # nodejs.org into ~/.cache/node-gyp on every cold checkout, which is both
        # an avoidable network fetch and a chance to compile against headers from
        # a different node than the one that will load the addon.
        npm_config_nodedir = "${pkgs.nodejs_22}";

        # Pin the interpreter node-gyp runs gyp with, by path. Left unset,
        # node-gyp takes the first `python3` on PATH -- which in this shell is
        # yt-dlp's propagated python3.14, not the python313 in the toolchain.
        npm_config_python = "${pkgs.python313}/bin/python3";

        # Registry chatter an agent cannot act on, and the update notifier is an
        # extra network round trip on every npm invocation.
        npm_config_fund = "false";
        npm_config_audit = "false";
        npm_config_update_notifier = "false";
      };

      # ======================================================================
      # PER-REPO BLOCK 4 -- the command map
      # ======================================================================
      # THE single source of truth. It generates `apps` (so `nix run .#build`
      # works), the `dev-*` wrappers on PATH inside the shell, and `dev-help`.
      # Nothing is written twice, so `nix flake show` can never disagree with
      # what `dev-build` actually runs.
      #
      # `test` is deliberately absent: package.json's test script is
      # `echo "Error: no test specified" && exit 1` and the repo ships no test
      # files. A stub that pretends otherwise would turn this map into a liar.
      #
      # `text` is bash under `set -euo pipefail`, shellcheck'd at BUILD time, and
      # it runs in the caller's current directory -- hence --prefix/absolute
      # paths below, so working from src/ does not fork a second node_modules.
      commands = pkgs: {
        setup = {
          # Why not a plain `npm ci`: it cannot succeed on any node major nixpkgs
          # still ships. package-lock.json pins nan 2.18.0, whose nan.h calls
          # v8::ObjectTemplate::SetAccessor with a v8::AccessControl argument that
          # V8 removed, so building `epoll` (pulled in by `onoff`) dies with
          # "no matching function for call to v8::ObjectTemplate::SetAccessor".
          # node 22 and 24 both hit it and nodejs_20 is gone from this nixpkgs
          # ("Node.js 20 support was removed given upstream End-of-Life on
          # 2026-04-30"), so there is no node to fall back to. A bare
          # `npm install` does succeed -- it floats nan to 2.28.0, which compiles
          # -- but it rewrites package-lock.json, and a bootstrap step must not
          # leave the work tree dirty.
          #
          # Hence: install the exact locked tree with no install scripts, then
          # build the ONE addon this codebase imports. Skipping epoll costs
          # nothing today -- `onoff` appears in package.json but nothing under
          # src/ imports it -- while bcrypt is used by src/main.ts and
          # src/bcrypt-cli.ts and is verified working after this step.
          #
          # The real fix belongs in the repo, not here: bump nan (or drop the
          # unused onoff dependency) and this becomes a plain `npm ci`.
          description = "(network) install the locked node_modules, then build the bcrypt addon";
          text = ''
            npm --prefix "$REPO_ROOT" ci --ignore-scripts "$@"
            npm --prefix "$REPO_ROOT" rebuild bcrypt
          '';
        };
        build = {
          description = "compile src/ to dist/ with the repo-pinned tsc (needs `setup` first)";
          text = ''npm --prefix "$REPO_ROOT" run build "$@"'';
        };
        lint = {
          # node_modules/.bin by absolute path, not a bare `eslint`. The wrappers
          # prepend the nix toolchain to PATH, which contains no eslint at all,
          # and `npm exec eslint` would try to fetch it from the registry.
          description = "eslint over src/ (needs `setup` first)";
          text = ''"$REPO_ROOT/node_modules/.bin/eslint" --ext .ts,.js "$REPO_ROOT/src" "$@"'';
        };
        fmt = {
          # The repo has no prettier; `standard` via eslint is the whole style
          # story, and --fix is the only thing here that rewrites files.
          description = "eslint --fix over src/ (rewrites files; needs `setup` first)";
          text = ''"$REPO_ROOT/node_modules/.bin/eslint" --ext .ts,.js --fix "$REPO_ROOT/src" "$@"'';
        };
        run = {
          # start:dev runs the TypeScript directly through ts-node rather than
          # dist/, so it does not need `build`.
          description = "start the service via ts-node (needs `setup` and a config.js -- see template_conf.js)";
          text = ''npm --prefix "$REPO_ROOT" run start:dev "$@"'';
        };
      };

      # ======================================================================
      # GENERIC MACHINERY -- byte-identical in all 41 repos, do not edit
      # ======================================================================

      # Prepend, never assign: a host LD_LIBRARY_PATH may be carrying something
      # the user needs, and clobbering it breaks binaries they launch from here.
      # Linux only -- on darwin the loader variable is DYLD_*, and exporting a
      # Linux-shaped value there is at best useless.
      ldPreamble =
        pkgs:
        lib.optionalString (pkgs.stdenv.hostPlatform.isLinux && nativeLibs pkgs != [ ]) ''
          export LD_LIBRARY_PATH="${lib.makeLibraryPath (nativeLibs pkgs)}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
        '';

      # Every command gets $REPO_ROOT. `nix run` and `nix develop` both start in
      # whatever directory they were invoked from, so a bare `node_modules`
      # silently forks a second environment as soon as an agent works from a
      # subdirectory. Note we do NOT cd there: commands act on the caller's cwd
      # on purpose.
      rootPreamble = ''
        REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
        export REPO_ROOT
      '';

      # One derivation per command, reused by both `apps` and the dev shell, so
      # the two can never diverge. `dev-` prefixed because a bare `test` binary
      # earlier on PATH would shadow the POSIX shell builtin and quietly break
      # every script in the repo that uses it.
      wrappers =
        pkgs:
        lib.mapAttrs (
          name: cmd:
          pkgs.writeShellApplication {
            name = "dev-${name}";
            runtimeInputs = toolchain pkgs;
            runtimeEnv = envVars pkgs;
            meta.description = cmd.description;
            text = ''
              ${rootPreamble}
              ${ldPreamble pkgs}
              ${cmd.text}
            '';
          }
        ) (commands pkgs);

      helpFor =
        pkgs:
        let
          cmds = commands pkgs;
          names = lib.attrNames cmds;
          width = lib.foldl' (a: n: lib.max a (builtins.stringLength n)) 0 names;
          pad = n: n + lib.concatStrings (lib.genList (_: " ") (width - builtins.stringLength n));
          line = n: c: "  dev-${pad n}  ${c.description}";
        in
        pkgs.writeShellApplication {
          name = "dev-help";
          meta.description = "print this repo's command map (works offline)";
          text = ''
            cat <<'EOF'
            ${lib.concatStringsSep "\n" (lib.mapAttrsToList line cmds)}
            EOF
          '';
        };
    in
    {
      # `nix flake show` -- the discovery entrypoint, and deliberately the whole
      # machine-facing contract: every app carries a meta.description, which
      # `nix flake show` prints inline and `nix flake show --json` exposes at
      # .apps.<system>.<name>.description. Pure evaluation, so an agent gets the
      # entire command map in one cheap call without reading a README.
      apps = forAllSystems (
        pkgs:
        lib.mapAttrs (name: cmd: {
          type = "app";
          program = "${(wrappers pkgs).${name}}/bin/dev-${name}";
          meta.description = cmd.description;
        }) (commands pkgs)
      );

      # `nix develop` -- the toolchain, plus a dev-<verb> for every app.
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = toolchain pkgs ++ lib.attrValues (wrappers pkgs) ++ [ (helpFor pkgs) ];

          env = envVars pkgs;

          # node-gyp addons compile at -O0, where glibc's _FORTIFY_SOURCE becomes
          # a hard error instead of a warning.
          hardeningDisable = [ "fortify" ];

          shellHook = ''
            # mkShell inherits SOURCE_DATE_EPOCH=315532800 (1980-01-01) from
            # stdenv, and any tarball or zip built in here then dies with "ZIP
            # does not support timestamps before 1980".
            unset SOURCE_DATE_EPOCH

            ${rootPreamble}
            ${ldPreamble pkgs}

            # Nothing networked, nothing stateful and nothing interactive above
            # this line, and nothing below it either. No `npm install`, no `npm
            # ci`, no `read`, no `exec $SHELL`. Bootstrapping in the hook makes a
            # cold `nix develop -c node --version` start downloading before it
            # runs anything, on EVERY invocation -- the exact failure an
            # unattended agent cannot diagnose. That is what `dev-setup` is for.

            # The banner is interactive-only, and this guard is load-bearing:
            # shellHook output lands on the STDOUT of `nix develop -c <cmd>`, so
            # an unguarded echo corrupts anything parsing it
            # (`nix develop -c cat x.json | jq` fails to parse). $- is the only
            # reliable discriminator here -- it lacks `i` for `nix develop -c`
            # and has it at an interactive prompt. Do not test $PS1 (unset in
            # both) or $IN_NIX_SHELL (set in both). >&2 is the second layer, for
            # the case where a caller runs us on a pty.
            case $- in
              *i*) echo "twitch_integrations dev shell -- 'dev-help' for the command map" >&2 ;;
            esac
          '';
        };
      });

      # `nix flake check` -- honest by construction. It realises the toolchain
      # closure (so a typo'd or currently-broken attr fails here) and builds
      # every wrapper, which runs shellcheck over every command text. NEVER add a
      # check that always passes: an agent reads "all checks passed!" as a
      # signal, and a fake check makes `nix flake check` a liar.
      #
      # There is no `checks.build` here on purpose: building this repo needs
      # node_modules from the network, which a nix build sandbox does not have.
      checks = forAllSystems (pkgs: {
        toolchain =
          pkgs.runCommand "toolchain-check"
            {
              nativeBuildInputs = toolchain pkgs ++ lib.attrValues (wrappers pkgs);
            }
            ''
              for verb in ${lib.escapeShellArgs (lib.attrNames (commands pkgs))}; do
                command -v "dev-$verb" > /dev/null || {
                  echo "dev-$verb is not on PATH" >&2
                  exit 1
                }
              done
              touch "$out"
            '';
      });

      # `nix fmt` -- formats the *Nix* in this repo; project code is `dev-fmt`.
      # nixfmt-tree (the treefmt wrapper) rather than bare nixfmt, because bare
      # nixfmt tries to parse every path handed to it and fails on non-Nix files.
      formatter = forAllSystems (pkgs: pkgs.nixfmt-tree);
    };
}
