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
        const kind = req.headers["pulumi-webhook-kind"];

        const payload = JSON.parse(req.body.toString());
        console.log("Payload: ", payload);

        let summary: string = "";

        let message: any = {
            channel: slackChannel,
            as_user: false,
            username: "BroomeBot",
            icon_emoji: ":robot_face:",
        };

        if (kind === "stack") {
            summary = `${payload.organization.githubLogin}/${payload.stackName} ${payload.action}.`;
            message.text = summary;
            message.attachments =[
                {
                    fallback: summary,
                    fields: [
                        {
                            title: "User",
                            value: `${payload.user.name} (${payload.user.githubLogin})`,
                            short: false,
                        },
                        {
                            title: "Action",
                            value: payload.action,
                            short: false,
                        },
                    ],
                },
            ];
        }

        if (kind === "team") {
            summary = `${payload.organization.githubLogin} team ${payload.action}.`;
            message.text = summary;
            message.attachments = [
                {
                    fallback: summary,
                    fields: [
                        {
                            title: "User",
                            value: `${payload.user.name} (${payload.user.githubLogin})`,
                            short: true,
                        },
                        {
                            title: "Team",
                            value: payload.team.name,
                            short: true,
                        },
                        {
                            title: "Stack",
                            value: `${payload.organization.githubLogin}/${payload.stackName}`,
                            short: true,
                        },
                        {
                            title: "Action",
                            value: payload.action,
                            short: true,
                        },
                        {
                            title: "Members",
                            value: payload.team.members.map((m: any) => `${m.name} (${m.githubLogin})`).join("\n"),
                            short: false,
                        },
                        {
                            title: "Stacks",
                            value: payload.team.stacks.map((s: any) => `${s.stackName} (${s.permission})`).join("\n"),
                            short: false,
                        },
                    ],
                },
            ];
        }

        if (kind === "stack_preview" || kind === "stack_update") {
            summary = `${resultEmoji(payload.result)} ${payload.organization.githubLogin}/${payload.stackName} ${payload.kind} ${payload.result}.`;
            message.text = summary;
            message.attachments = [
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
                            title: "Event Kind",
                            value: kind,
                            short: false,
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
            ];

            function resultColor(result: string): string {
                switch (result) {
                    case "succeeded":
                        return "#36a64f";
                    case "failed":
                        return "#e01563";
                }
                return "#e9a820";
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
        }

        await client.chat.postMessage(message);
        console.log("Message: ", JSON.stringify(message, null, 2));
        res.end();

    } catch (err) {
        console.error("Error: ", err);
        res.status(500).end("Internal Server Error");
    }
});

export const url = app.publish().url;
