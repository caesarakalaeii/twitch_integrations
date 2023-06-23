export const htmlString = `
<!DOCTYPE html>
<html>
  <head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credits</title>
  <style>

      /* Font styles */
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&display=swap');
      body {
        font-family: 'Roboto', sans-serif;
      }
      .header, .list_title, .closure {
        font-family: 'Comfortaa', cursive;
      }

      /*Rest of the styles*/
      .header {
        font-size: 40px;
        font-weight: bold;
        color: blue;
        padding-bottom: 100px;
      }
      .closure {
        font-size: 40px;
        font-weight: bold;
        color: blue;
        padding-top: 100px;
      }
      .username {
        font-size: 25px;
        font-weight: bold;
        color: purple;
      }
      .message {
        word-wrap: break-word;
        font-size: 22px;
        color: white;
        max-width: 400px;
      }

      /* Flexbox styles */
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        background-color: rgba(0,0,0,100);
      }
      .list_title{
        padding-bottom: 50px;
        padding-top: 50px;
        text-decoration: underline;
        font-size: 35px;
        color: white;
      }
      .list_container {
        list-style-type: none;
        padding: 0;
        margin: 0;
      }
      .list_item {
        color : white;
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      .list_container_no_break {
        list-style-type: none;
        padding: 0;
        margin: 0;
        display: flex; /* Add this line */
        flex-wrap: wrap; /* Add this line */
      }
      
      .list_item_no_break {
        font-size: 25px;
        color: white;
        display: inline-flex; /* Change from "flex" to "inline-flex" */
        align-items: center;
        margin-right: 10px; /* Add this line */
      }
      
      .list_item .username {
        margin-right: 10px;
      }
      .list_item .message {
        margin-left: 10px;
      }
    </style>
  </head>
  <body>
    <div class = "header">Thanks for watching!</div>
    <div class = "list_title">Gifted Subs:</div>
    <div class="list_container">
      <% gifted.forEach(function(event) { %>
        <div class = "list_item">
          <span class="username"><%= event.user %></span> -
          <span class="message"><%= event.message %></span>
        </div>
      <% }) %>
    </div>
    
    <div class = "list_title">New Subscriptions:</div>
    <div class="list_container">
      <% newSubs.forEach(function(event) { %>
        <div class = "list_item">
          <span class="username"><%= event.user %></span> -
          <span class="message"><%= event.message %></span>
        </div>
      <% }) %>
    </div>
    
      <div class="list_title">Current Subscribers:</div>
      <div class="list_container_no_break">
        <% currentSubs.forEach(function(user, index) { %>
          <div class="list_item_no_break"><%= user %><% if (index !== currentSubs.length - 1) { %>, <% } %></div>
        <% }) %>
    </div>

    <div class = "list_title">Cheers:</div>
    <div class="list_container">
      <% cheers.forEach(function(event) { %>
        <div class = "list_item">
          <span class="username"><%= event.user %></span> -
          <span class="message"><%= event.message %></span>
        </div>
      <% }) %>
    </div>
    <div class = "list_title">Redeems:</div>
    <div class="list_container">
      <% redeems.forEach(function(event) { %>
        <div class = "list_item">
          <span class="username"><%= event.user %></span> -
          <span class="message"><%= event.message %></span>
        </div>
      <% }) %>
    </div>
    <div class="list_title">Follows:</div>
<div class="list_container_no_break">
  <% follows.forEach(function(user, index) { %>
    <div class="list_item_no_break"><%= user %></div><% if (index !== follows.length - 1) { %>, <% } %>
  <% }) %>
</div>


    <div class = "closure">Sweet dreams of sour pickles</div>
  </body>
</html>


`