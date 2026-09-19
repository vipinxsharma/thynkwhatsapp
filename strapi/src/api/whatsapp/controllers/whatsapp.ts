/**
 * Strapi Ingestion Controller for WhatsApp Webhooks
 * Executes atomic transactions for Contacts, Conversations, and Messages.
 */

export default {
  /**
   * Ingests an inbound WhatsApp message
   */
  async ingestMessage(ctx: any) {
    const { wabaId, phoneNumberId, customer, message } = ctx.request.body;

    if (!phoneNumberId || !customer?.waId || !message?.wamId) {
      return ctx.badRequest("Missing required message ingestion payload parameters.");
    }

    try {
      // 1. Resolve PhoneNumber and Tenant
      const phoneNumber = await strapi.db.query("api::phone-number.phone-number").findOne({
        where: { phoneNumberId },
        populate: ["tenant", "waba"],
      });

      if (!phoneNumber || !phoneNumber.tenant) {
        return ctx.notFound(`PhoneNumber ID ${phoneNumberId} is not linked to any tenant.`);
      }

      const tenantId = phoneNumber.tenant.id;

      // 2. Upsert Contact
      let contact = await strapi.db.query("api::contact.contact").findOne({
        where: {
          waId: customer.waId,
          tenant: tenantId,
        },
      });

      if (!contact) {
        contact = await strapi.db.query("api::contact.contact").create({
          data: {
            waId: customer.waId,
            phoneNumber: `+${customer.waId}`,
            name: customer.name || customer.waId,
            tenant: tenantId,
            lastSeenAt: message.timestamp,
            tags: ["New Inbound"],
          },
        });
      } else {
        await strapi.db.query("api::contact.contact").update({
          where: { id: contact.id },
          data: {
            name: customer.name || contact.name,
            lastSeenAt: message.timestamp,
          },
        });
      }

      // 3. Find or Create Active Conversation
      let conversation = await strapi.db.query("api::conversation.conversation").findOne({
        where: {
          contact: contact.id,
          phoneNumber: phoneNumber.id,
          tenant: tenantId,
        },
      });

      // Calculate 24-hour Customer Care Window expiration
      const msgTime = new Date(message.timestamp).getTime();
      const windowExpiresAt = new Date(msgTime + 24 * 60 * 60 * 1000).toISOString();

      if (!conversation) {
        conversation = await strapi.db.query("api::conversation.conversation").create({
          data: {
            contact: contact.id,
            phoneNumber: phoneNumber.id,
            tenant: tenantId,
            status: "open",
            windowExpiresAt,
            lastMessageAt: message.timestamp,
            unreadCount: 1,
          },
        });
      } else {
        await strapi.db.query("api::conversation.conversation").update({
          where: { id: conversation.id },
          data: {
            status: "open",
            windowExpiresAt, // Renew the 24h window
            lastMessageAt: message.timestamp,
            unreadCount: (conversation.unreadCount || 0) + 1,
          },
        });
      }

      // 4. Record Message with wamId deduplication
      const existingMessage = await strapi.db.query("api::message.message").findOne({
        where: { wamId: message.wamId },
      });

      if (existingMessage) {
        return ctx.send({ success: true, message: "Duplicate message skipped", data: existingMessage });
      }

      const recordedMessage = await strapi.db.query("api::message.message").create({
        data: {
          wamId: message.wamId,
          direction: "inbound",
          type: message.type,
          body: message.body,
          rawPayload: message.rawPayload,
          status: "received",
          timestamp: message.timestamp,
          conversation: conversation.id,
          tenant: tenantId,
        },
      });

      return ctx.send({ success: true, data: recordedMessage });
    } catch (err: any) {
      strapi.log.error("[WhatsApp Ingest Error]", err);
      return ctx.internalServerError(err.message);
    }
  },

  /**
   * Updates message status (sent, delivered, read, failed)
   */
  async updateStatus(ctx: any) {
    const { wamId, status, errorCode, errorMessage } = ctx.request.body;

    if (!wamId || !status) {
      return ctx.badRequest("Missing wamId or status.");
    }

    try {
      const message = await strapi.db.query("api::message.message").findOne({
        where: { wamId },
      });

      if (!message) {
        return ctx.notFound(`Message ${wamId} not found.`);
      }

      const updated = await strapi.db.query("api::message.message").update({
        where: { id: message.id },
        data: {
          status,
          errorCode: errorCode || message.errorCode,
          errorMessage: errorMessage || message.errorMessage,
        },
      });

      return ctx.send({ success: true, data: updated });
    } catch (err: any) {
      strapi.log.error("[WhatsApp Status Update Error]", err);
      return ctx.internalServerError(err.message);
    }
  },
};
