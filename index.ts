import * as pulumi from "@pulumi/pulumi";
import * as cloud from "@pulumi/cloud-aws";
import { ChatPostMessageArguments, MessageAttachment, WebClient } from "@slack/client";

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
        const kind = req.headers["pulumi-webhook-kind"];

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
                            short: true,
                        },
                        {
                            title: "Action",
                            value: payload.action,
                            short: true,
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
                            value: payload.team.members.map((m: any) => `• ${m.name} (${m.githubLogin})`).join("\n"),
                            short: false,
                        },
                        {
                            title: "Stacks",
                            value: payload.team.stacks.map((s: any) => `• ${s.stackName} (${s.permission})`).join("\n"),
                            short: false,
                        },
                    ],
                },
            ];
        }

        if (kind === "stack_preview" || kind === "stack_update") {
            summary = `${payload.organization.githubLogin}/${payload.stackName} ${payload.kind} ${payload.result}.`;
            message.text = `${resultEmoji(payload.result)} ${summary}`;
            message.attachments = [
                {
                    fallback: `${summary}: ${payload.updateUrl}`,
                    color: resultColor(payload.result),
                    fields: [
                        {
                            title: "User",
                            value: `${payload.user.name} (${payload.user.githubLogin})`,
                            short: true,
                        },
                        {
                            title: "Stack",
                            value: `${payload.organization.githubLogin}/${payload.stackName}`,
                            short: true,
                        },
                        {
                            title: "Resource Changes",
                            value: Object.keys(payload.resourceChanges)
                                .map(key => `• ${titleCase(key)}: ${payload.resourceChanges[key]}`)
                                .join("\n"),
                            short: true,
                        },
                        {
                            title: "Kind",
                            value: titleCase(kind.replace("stack_", "")),
                            short: true,
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

            function resultEmoji(result: string): string {
                switch (result) {
                    case "succeeded":
                        return ":tropical_drink:";
                    case "failed":
                        return ":rotating_light:";
                }
                return "";
            }

            function titleCase(s: string): string {
                return [s.charAt(0).toUpperCase(), s.substr(1)].join("");
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

// Export the webhook's public URL.
export const url = app.publish().url;
