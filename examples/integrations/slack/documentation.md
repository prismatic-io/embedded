# Slack Notifications

Posts Acme notifications to a Slack channel.

This integration uses headless configuration. After the customer connects Slack,
they choose a channel: the `listChannels` server function reads the channels of
their workspace with their connection. In the example embedded app, that choice
appears in a dialog right after the customer clicks **Connect**.

The **Post Acme Notifications** flow takes `{ "text": "..." }` at its webhook URL
and posts it to the chosen channel. It posts any other body as JSON.

The Slack connection is a customer-activated connection with the stable key
`slack-oauth`. The Slack app needs the `channels:read`, `groups:read`,
`chat:write`, and `chat:write.public` bot scopes.
