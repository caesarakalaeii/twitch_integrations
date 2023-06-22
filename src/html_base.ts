export const htmlString = `
<!DOCTYPE html>
<html>
  <head>
    <title>Generated HTML</title>
  </head>
  <body>
    <h1>New Subscriptions:</h1>
    <ul>
      <% newSubs.forEach(function(event) { %>
        <li><%= event.name %> - <%= event.timestamp %></li>
      <% }) %>
    </ul>
    <h1>Current Subscribers:</h1>
    <ul>
      <% currentSubs.forEach(function(name) { %>
        <li><%= name %></li>
      <% }) %>
    </ul>
    <h1>Cheers:</h1>
    <ul>
      <% cheers.forEach(function(event) { %>
        <li><%= event.name %> - <%= event.timestamp %></li>
      <% }) %>
    </ul>
    <h1>Redeems:</h1>
    <ul>
      <% redeems.forEach(function(event) { %>
        <li><%= event.name %> - <%= event.timestamp %></li>
      <% }) %>
    </ul>
    <h1>Follows:</h1>
    <ul>
      <% follows.forEach(function(name) { %>
        <li><%= name %></li>
      <% }) %>
    </ul>
  </body>
</html>
`