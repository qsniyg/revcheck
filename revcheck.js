var request = require('request');
var cheerio = require('cheerio');
const NodeCache = require( "node-cache" );
const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');

var env_json = {};
require('dotenv').config();
env_json.user_agent = process.env.USERAGENT;
env_json.client_id = process.env.CLIENT_ID;
env_json.client_secret = process.env.CLIENT_SECRET;
if (false) {
  env_json.refresh_token = process.env.REFRESH_TOKEN;
  env_json.access_token = process.env.ACCESS_TOKEN;
} else {
  env_json.username = process.env.REDDIT_USER;
  env_json.password = process.env.REDDIT_PASS;
}

const r = new Snoowrap(env_json);
r.config({requestDelay: 1001});
const client = new Snoostorm(r);

function check_google(imageurl, cb) {
  console.log("Checking " + imageurl);

  var url1 = "https://www.google.com/searchbyimage?image_url=";
  var url2 = "&btnG=Search+by+image&encoded_image=&image_content=&filename=&hl=en-US";
  var url = url1 + encodeURIComponent(imageurl) + url2;
  //console.log(url);

  request({
    method: 'GET',
    uri: url,
    headers: {'user-agent': 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11'}
  }, function(error, response, body) {
    if (error) {
      console.error(error);
      return;
    }

    var $ = cheerio.load(body);
    var headers = $("div[role='heading']");
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (!header)
        continue;

      var text = $(header).text();
      if (text.toLowerCase().indexOf("pages that include") >= 0) {
        cb($(header), $);
        return;
      }
    }

    cb(false);
  });
}

function check_image(imageurl, cb) {
  // TODO: rate limiting
  console.log("Checking " + imageurl);
  return check_google(imageurl, cb);
}

const links = new NodeCache({ stdTTL: 600, checkperiod: 1000 });
var starttime = Date.now() / 1000;

if (true) {
  var submissionStream = client.SubmissionStream({
    "subreddit": process.env.SUBREDDIT,
    "results": 50,
    "pollTime": 10000
  });

  console.log("Starting");

  submissionStream.on("submission", function(post) {
    if (post.domain.startsWith("self."))
      return;

    console.log(post.domain);

    if (post.created_utc < starttime ||
        ((Date.now() / 1000) - post.created_utc) >= 30)
      return;

    //console.dir(JSON.parse(JSON.stringify(post)));

    try {
      var url = post.preview.images[0].source.url;

      check_image(url, function(found, $) {
        if (found !== false) {
          console.log("Found!");
          var sibling = found.parent().next();
          //console.log(sibling.html());
          var closest = sibling.find(".srg > .g .r > a");
          var foundhref = "(error)";
          if (closest) {
            //console.log($(closest).html());
            console.log($(closest).attr("href"));
            foundhref = $(closest).attr("href");
          }

          var comment = process.env.COMMENT_TEXT.replace("%%", foundhref);
          post.reply(comment);
        } else {
          console.log("Not found!");
        }
      });
    } catch (e) {
    }
  });
}
