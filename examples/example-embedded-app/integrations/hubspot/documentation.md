# HubSpot Contacts

Creates and updates HubSpot contacts from Acme contacts.

This integration uses headless configuration, and needs nothing from the customer
except a HubSpot connection. Its configuration has no fields, so the example
embedded app deploys it as soon as the customer authorizes HubSpot: one click on
**Connect**.

The **Sync Contacts to HubSpot** flow takes one Acme contact, or
`{ "contacts": [...] }`, at its webhook URL. It creates or updates each contact in
HubSpot, matched by email.

The HubSpot connection is a customer-activated connection with the stable key
`hubspot-oauth`. The HubSpot app needs the `oauth`, `crm.objects.contacts.read`,
and `crm.objects.contacts.write` scopes.
