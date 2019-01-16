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
        const client = new slack.WebClient(slackToken);
        const payload = JSON.parse(req.body.toString());
        const summary = `${resultEmoji(payload.result)} ${payload.organization.githubLogin}/${payload.stackName} ${payload.kind} ${payload.result}.`;

        function resultColor(result: string): string {
            switch (result) {
                case "succeeded":
                    return "#36a64f";
                case "failed":
                    return "#e01563";
            }
            return "e9a820";
        }

        function resultEmoji(result: string) {
            switch (result) {
                case "succeeded":
                    return ":tropical_drink:";
                case "failed":
                    return ":confused:";
            }
            return "";
        }

        const message = {
            channel: slackChannel,
            text: summary,
            as_user: false,
            username: "BroomeBot",
            icon_emoji: ":robot_face:",
            attachments: [
                {
                    fallback: `${summary}: ${payload.updateUrl}`,
                    color: resultColor(payload.result),
                    fields: [

                        {
                            title: "Stack",
                            value: `${payload.organization.githubLogin}/${payload.stackName}`,
                            short: true,
                        },
                        {
                            title: "User",
                            value: `${payload.user.name} (${payload.user.githubLogin})`,
                            short: true,
                        },
                        {
                            title: "Resources",
                            value: "```" + JSON.stringify(payload.resourceChanges, null, 2) + "```",
                            short: false,
                        },
                        {
                            title: "Permalink",
                            value: payload.updateUrl,
                            short: false,
                        },
                    ],
                },
            ],
        };

        await client.chat.postMessage(message);

        console.log("Payload: ", payload);
        console.log("Message: ", JSON.stringify(message, null, 2));
        res.end();
    } catch (err) {
        console.error("Error: ", err);
        res.status(500).end("Internal Server Error");
    }
});

export const url = app.publish().url;
