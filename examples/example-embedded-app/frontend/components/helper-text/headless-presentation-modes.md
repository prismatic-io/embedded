# Presentation Modes

With headless configuration, your app decides how a configuration looks. This page sets up the **Fake CRM** integration two ways:

- **Single page** shows every question at once: the record type, the field mapping, and a live preview.
- **Multi-step wizard** asks one question per step: first the record type, then the field mapping and preview.

Both are the same form component with a different layout. They collect the same values, and the Solis calls don't change: `init` suggests values, `save` validates and stores the customer's choices, and the instance's `deploy` makes them live. Switch modes halfway through and the values carry over, since the form keeps them.

Click **Deploy Fake CRM** to start. Once the instance is deployed, **Reconfigure Fake CRM** opens the same form with the saved values, and **Remove** deletes the instance so you can start again.

## Set it up

The page needs the Fake CRM integration in your marketplace. Its source is in `integrations/fake-crm/`. See the README for import and publish steps.

## Read the code

- `frontend/routes/examples/headless-presentation-modes.tsx` holds the mode switch and the deploy button.
- `frontend/components/headless/fake-crm-configuration-form.tsx` draws both layouts.
- `frontend/components/headless/configuration-editor.tsx` runs `init`, `save`, and `deploy`.
