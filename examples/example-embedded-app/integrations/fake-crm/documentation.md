# Fake CRM

Syncs people from Fake CRM, a stand-in for a Salesforce-like CRM, to Acme as contacts.

This integration uses headless configuration. It has no config wizard. Instead, the
example embedded app renders its own form, built with `@prismatic-io/solis-react`:

1. Choose the Fake CRM record type that holds your people: Lead, Contact, or the custom
   `Hooli_Leads__c` object.
2. Map that record type's fields to Acme's contact fields.
3. Preview the Acme contact your mapping makes from a sample record.

The **Sync Contacts to Acme** flow reads the saved configuration, maps each record, and
logs the contact it would send to Acme. Fake CRM's data is static, so the integration
needs no connection.
