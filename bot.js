var config = require("./config.json");
var irc = require("irc");
var fs = require("fs");

var mw = require("nodemw");

const regex = /https?:\/\/(.*\/(index\.php|wiki)).* \* (.*) \*/;

var wikianet = new irc.Client(
  config.sourceirchost,
  config.sourceNick,
  {
    channels:[
      "#discussionsfeed"
    ],
    retryCount: 99,
    userName: "tybot",
    realName: config.realname,
    debug:false,
    autoConnect: true,
    stripColors: true,
    port:config.sourceircport
  }
);

var freenode = new irc.Client(
  config.commandirchost,
  config.commandnick,
  {
    channels: [
      "#tybot"
    ],
    sasl: false,
    retryCount: 99,
    userName: "tybot",
    realName: config.realname,
    password: config.nickservpass,
    debug: false,
    autoConnect: true
  }
);

wikianet.addListener("error", function(message) {
  console.error("ERROR: %s: %s", message.command, message.args.join(" "));
});

freenode.addListener("error", function(message) {
  console.error("ERROR: %s: %s", message.command, message.args.join(" "));
});

freenode.addListener("message", function(nick, to, text, message) {
  if(!text.startsWith(config.trigger)) {
    return;
  }

  // only users with vstf cloaks can use commands
  if(!message.host.startsWith("wikia/vstf/")) {
    return;
  }

  const args = text.slice(config.trigger.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  var lang;

  switch(command) {
  case "add":
    //TODO ^add User_Name {{w:Template}} lang (or empty for english)
    if(args.length < 2) {
      freenode.say(message.args[0], "Not enough params, pls use ^add User_Name {{w:Template_Name}} lang (or blank for English)");
      return;
    } else if (args.length == 2) {
      lang = "en";
    } else {
      lang = args[2];
    }
    // ensure we have an object to add our config to
    if(typeof config["users"][args[0]] === "undefined") {
      config["users"][args[0]] = {};
    }
    config["users"][args[0]][lang] = args[1];
    fs.writeFile("./config.json", JSON.stringify(config), (err) => console.error);

    freenode.say(message.args[0], message.nick + ": Added template " + args[1] + " for " + args[0] + " on " + lang + " wikis");
    break;
  case "remove":
    //TODO ^remove User_Name lang (or empty for all)
    // since delete doesn't error if it doesn't exist, should I worry about leaving a message if it doesn't? Or just say it worked?
    if(args.length == 0) {
      freenode.say(message.args[0], "Not enough params, pls use ^remove User_Name {{w:Template_Name}} lang (or blank for all)");
      return;
    } else if (args.length == 1) {
      delete config["users"][args[0]];
      freenode.say(message.args[0], message.nick + ": Removed all userpage templates for " + args[0]);
      // remove all
    } else {
      //remove
      freenode.say(message.args[0], message.nick + ": Removed template for " + args[0] + " on " + args[1] + " wikis");
      delete config["users"][args[0]][args[1]];
    }

    fs.writeFile("./config.json", JSON.stringify(config), (err) => console.error);
    break;
  }
  //console.log(message);
});

wikianet.addListener("message", function(nick, to, text, message) {
  var event;
  try {
    event = JSON.parse(text);
  } catch(error) {
    console.log("json parse error");
    console.error(error);
    return;
  }

  event.userName = event.userName.replace(/ /g, "_");
  if(!config.users.hasOwnProperty(event.userName)) {
    return;
  }

  event.url = event.url.replace("http://", "");
  event.url = event.url.split("/d/p")[0];

  var lang;
  if(event.url.indexOf("fandom.com") == -1) {
    // we have a wikia.com domain
    // 	`ru.tvpedia.wikia.com/index.php`
    var subdomain = event.url.split(".wikia")[0];
    if(subdomain.indexOf(".") != -1) {
      lang = subdomain.split(".")[0];
    } else {
      lang = "en";
    }
  } else {
    // we have a fandom.com domain
    // subject.fandom.com/langcode
    if(event.url.indexOf(".com/") == -1) {
      // there is no /langCode
      lang = "en";
    } else {
      lang = event.url.split(".com/")[1].replace(".com/", "");
    }

  }

  event.url = event.url.split("/")[0];
  try {
    var bot = new mw({
      server: event.url,
      path: (event.url.indexOf("fandom.com") > -1) ? ((lang == "en")? "": "/" + lang): "",
      debug:false,
      protocol:(event.url.indexOf("wikia.com") > -1 && lang != "en")? "http": "https", // use http on language wikia wikis
      username: config.fandomuser,
      password: config.fandompass
    });

    bot.getArticle("User:" + event.userName, function(err, content) {
      //console.log(content);
      if(typeof content !== "undefined") {
        return;
      }
      bot.logIn(function() {
        var text;
        // try the lang provided, then try English, then abort
        if(config.users[event.userName].hasOwnProperty(lang)) {
          text = config.users[event.userName][lang];
        } else if (config.users[event.userName].hasOwnProperty("en")) {
          text = config.users[event.userName].en;
        } else {
          console.error("No english template for " + event.userName);
          return;
        }

        bot.edit("User:" + event.userName, text, "Creating userpage for " + event.userName, function(err, res) {
          console.log("Creating userpage for " + event.userName + " at " + event.url);
        });
      });
    });
  } catch(error) {
    console.error(error);
    console.log("site: " + event.url);
    return;
  }
});
