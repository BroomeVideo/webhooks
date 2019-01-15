// Inspired by:
// https://github.com/pulumi/home/blob/master/infrastructure/build-failure-notifier/index.ts

import * as pulumi from "@pulumi/pulumi";
import * as cloud from "@pulumi/cloud-aws";
import * as slack from "@slack/client";

const config = new pulumi.Config();
const slackChannel = config.require("slackChannel");
const slackToken = config.require("slackToken");
const app = new cloud.HttpEndpoint("webhooks");

app.get("/", async (req, res) => {
    res.status(200);
    res.write("BroomeVideo/webhooks\n");
    res.end();
});

app.post("/", async (req, res) => {
    try {
        console.log("Got POST request.");
        const payload = JSON.parse(<string>req.body.toString());
        console.log("JSON obj", payload);

        const client = new slack.WebClient(slackToken);
        await client.chat.postMessage(
            {
                channel: slackChannel,
                text: "```" + JSON.stringify(payload, null, 2) + "```",
                as_user: true,
            });
        res.end();
    } catch (err) {
        console.log("error: " + err);
        res.status(500).end("Internal Server Error");
    }
});

export const url = app.publish().url;
