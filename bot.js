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
      "#rc"
    ],
    retryCount: 15,
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
      "#wikia-janitors"
    ],
    sasl: false,
    retryCount: 15,
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
  var match = regex.exec(text);
  if(match == null) {

    console.log("does not match");
    console.log(text);
    return;
  }
  match[3] = match[3].replace(/ /g, "_");
  match[1] = match[1].replace("/wiki", "").replace("/index.php", "");
  if(config.users.hasOwnProperty(match[3])) {
    var bot = new mw({
      server: match[1],
      path: "",
      debug:false,
      username: config.fandomuser,
      password: config.fandompass
    });

    bot.getArticle("User:" + match[3], function(err, content) {
      //console.log(content);
      if(typeof content !== "undefined") {
        return;
      }
      bot.logIn(function() {
        var lang;
        if(match[1].indexOf("fandom.com") == -1) {
          // we have a wikia.com domain
          // 	`ru.tvpedia.wikia.com/index.php`
          var subdomain = match[1].split(".wikia")[0];
          if(subdomain.indexOf(".") != -1) {
            lang = subdomain.split(".")[0];
          } else {
            lang = "en";
          }
        } else {
          // we have a fandom.com domain
          // subject.fandom.com/langcode
          if(match[1].indexOf("/") == -1) {
            // there is no /langCode
            lang = "en";
          } else {
            lang = match[1].split("/")[1].replace("/", "");
          }

        }

        var text;
        // try the lang provided, then try English, then abort
        if(config.users[match[3]].hasOwnProperty(lang)) {
          text = config.users[match[3]][lang];
        } else if (config.users[match[3]].hasOwnProperty("en")) {
          text = config.users[match[3]].en;
        } else {
          console.error("No english template for " + match[3]);
          return;
        }
        console.log("Creating userpage for " + match[3] + " at " + match[1]);
        bot.edit("User:" + match[3], text, "Creating userpage for " + match[3], function(err, res) {
          console.log("Creating userpage for " + match[3] + " at " + match[1]);
        });
      });
    });
  }
});
