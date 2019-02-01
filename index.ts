import * as pulumi from "@pulumi/pulumi";
import * as cloud from "@pulumi/cloud-aws";
import { ChatPostMessageArguments, MessageAttachment, WebClient } from "@slack/client";
import { formatSlackMessage } from "./util";

const app = new cloud.HttpEndpoint("webhooks");
const config = new pulumi.Config();

// Pull the destination channel and Slack token from the
// stack-specific configuration.
const slackChannel = config.require("slackChannel");
const slackToken = config.require("slackToken");

// Define an HTTP POST handler for receiving the Pulumi service webhook.
app.post("/", async (req, res) => {
    try {
        const client = new WebClient(slackToken);
        const kind = req.headers["pulumi-webhook-kind"] as string;

        const payload = JSON.parse(req.body.toString());
        const stringified = JSON.stringify(payload, null, 2);
        console.log("Payload: ", payload);

        let summary: string;
        let message: ChatPostMessageArguments = {
            channel: slackChannel,
            as_user: false,
            username: "BroomeBot",
            icon_emoji: ":robot_face:",
            text: "```" + stringified + "```",
        };

        // Vary the message formatting slightly based on the kind of webhook received.
        // See the Pulumi documentation for details.

        await client.chat.postMessage(formatSlackMessage(kind, payload, message));
        console.log("Message: ", JSON.stringify(message, null, 2));
        res.end();

    } catch (err) {

        console.error("Error: ", err);
        res.status(500).end("Internal Server Error");
    }
});

// Export the webhook's public URL.
export const url = app.publish().url;
