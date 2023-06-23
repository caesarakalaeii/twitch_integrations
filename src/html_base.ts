export const htmlString = `
<!DOCTYPE html>
<html>
  <head>
    <title>Thanks for watching!</title>
    <style>
      h1 {
        color: blue;
      }
      h2 {
        color: white;
      }
      .username {
        color: purple;
      }
      .message {
        color: white;
      }

      /* Flexbox styles */
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        background-color: rgba(0,0,0,0);
      }
      ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
      }
      li {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      li .username {
        margin-right: 10px;
      }
    </style>
  </head>
  <body>
    <h2>New Subscriptions:</h2>
    <ul>
      <% newSubs.forEach(function(event) { %>
        <li>
          <span class="username"><%= event.user %></span> -
          <span class="message"><%= event.message %></span>
        </li>
      <% }) %>
    </ul>
    <h2>Current Subscribers:</h2>
    <ul>
      <% currentSubs.forEach(function(user) { %>
        <li><%= user %></li>
      <% }) %>
    </ul>
    <h2>Cheers:</h2>
    <ul>
      <% cheers.forEach(function(event) { %>
        <li>
          <span class="username"><%= event.user %></span> -
          <span class="message"><%= event.message %></span>
        </li>
      <% }) %>
    </ul>
    <h2>Redeems:</h2>
    <ul>
      <% redeems.forEach(function(event) { %>
        <li>
          <span class="username"><%= event.user %></span> -
          <span class="message"><%= event.message %></span>
        </li>
      <% }) %>
    </ul>
    <h2>Follows:</h2>
    <ul>
      <% follows.forEach(function(user) { %>
        <li><%= user %></li>
      <% }) %>
    </ul>
    <h2>Sweet dreams of sour pickles</h2>
  </body>
</html>


`