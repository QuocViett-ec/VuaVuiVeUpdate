"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const Voucher = require("../models/Voucher.model");
const Shipment = require("../models/Shipment.model");

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const dryRun = args.has("--dry-run");
  const limitArg = argv.find((item) =>
    String(item || "").startsWith("--limit="),
  );
  const limit = limitArg
    ? Math.max(0, Number.parseInt(limitArg.split("=")[1], 10) || 0)
    : 0;
  return { dryRun, limit };
}

function mapOrderStatusToShipmentStatus(orderStatus) {
  const normalized = String(orderStatus || "").toLowerCase();
  if (normalized === "shipping") return "in_transit";
  if (normalized === "delivered") return "delivered";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "returned" || normalized === "refunded") return "returned";
  return "pending";
}

function toObjectIdArray(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || ""))
        .filter((value) => mongoose.Types.ObjectId.isValid(value)),
    ),
  );
}

async function resolveVoucherIdByCode(code, cache) {
  const normalized = String(code || "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized);

  const voucher = await Voucher.findOne({ code: normalized })
    .select("_id")
    .lean();
  const voucherId = voucher?._id ? String(voucher._id) : null;
  cache.set(normalized, voucherId);
  return voucherId;
}

async function run() {
  const { dryRun, limit } = parseArgs(process.argv);

  const stats = {
    scannedOrders: 0,
    createdShipments: 0,
    linkedExistingShipments: 0,
    updatedOrders: 0,
    linkedVoucherIds: 0,
    skippedOrders: 0,
    errors: 0,
  };

  console.log(
    JSON.stringify({
      event: "migration.start",
      migration: "order-logistics",
      dryRun,
      limit,
    }),
  );

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const voucherCache = new Map();
  const cursor = Order.find({})
    .select(
      "_id userId status delivery shippingFee deliveredAt voucherCode voucherId shipmentIds",
    )
    .sort({ createdAt: 1 })
    .cursor();

  for (
    let order = await cursor.next();
    order != null;
    order = await cursor.next()
  ) {
    if (limit > 0 && stats.scannedOrders >= limit) break;

    stats.scannedOrders += 1;

    try {
      const existingShipments = await Shipment.find({ orderId: order._id })
        .select("_id")
        .sort({ createdAt: 1 })
        .lean();

      let nextShipmentIds = toObjectIdArray(order.shipmentIds).slice();
      let createdShipmentId = null;

      if (!existingShipments.length) {
        const shipmentStatus = mapOrderStatusToShipmentStatus(order.status);
        const createPayload = {
          orderId: order._id,
          customerId: order.userId,
          shippingFee: Number(order.shippingFee || 0),
          deliveredAt:
            shipmentStatus === "delivered"
              ? order.deliveredAt || new Date()
              : null,
          currentStatus: shipmentStatus,
          deliverySnapshot: {
            name: String(order.delivery?.name || ""),
            phone: String(order.delivery?.phone || ""),
            address: String(order.delivery?.address || ""),
            slot: String(order.delivery?.slot || ""),
          },
          statusHistory: [
            {
              status: shipmentStatus,
              source: "migration",
              note: `Initialized from order status: ${String(order.status || "pending")}`,
            },
          ],
        };

        if (!dryRun) {
          const created = await Shipment.create(createPayload);
          createdShipmentId = String(created._id);
        } else {
          createdShipmentId = "__dry_run_shipment_id__";
        }

        stats.createdShipments += 1;
        if (!dryRun && createdShipmentId) {
          nextShipmentIds.push(createdShipmentId);
        }
      } else {
        stats.linkedExistingShipments += 1;
        for (const row of existingShipments) {
          nextShipmentIds.push(String(row._id));
        }
      }

      nextShipmentIds = Array.from(new Set(nextShipmentIds.filter(Boolean)));

      let nextVoucherId = order.voucherId ? String(order.voucherId) : null;
      if (!nextVoucherId && order.voucherCode) {
        nextVoucherId = await resolveVoucherIdByCode(
          order.voucherCode,
          voucherCache,
        );
      }

      const updateSet = {};
      if (!dryRun) {
        const currentShipmentIds = toObjectIdArray(order.shipmentIds);
        const shipmentChanged =
          currentShipmentIds.length !== nextShipmentIds.length ||
          currentShipmentIds.some((id, idx) => id !== nextShipmentIds[idx]);

        if (shipmentChanged && nextShipmentIds.length) {
          updateSet.shipmentIds = nextShipmentIds;
        }

        if (!order.voucherId && nextVoucherId) {
          updateSet.voucherId = nextVoucherId;
          stats.linkedVoucherIds += 1;
        }

        if (Object.keys(updateSet).length) {
          await Order.updateOne({ _id: order._id }, { $set: updateSet });
          stats.updatedOrders += 1;
        } else {
          stats.skippedOrders += 1;
        }
      }

      if (dryRun && !order.voucherId && nextVoucherId) {
        stats.linkedVoucherIds += 1;
      }
      if (dryRun) {
        stats.updatedOrders += 1;
      }
    } catch (err) {
      stats.errors += 1;
      console.error(
        JSON.stringify({
          event: "migration.order.error",
          orderId: String(order?._id || ""),
          message: err.message,
        }),
      );
    }
  }

  await mongoose.disconnect();

  console.log(
    JSON.stringify({
      event: "migration.done",
      migration: "order-logistics",
      ...stats,
    }),
  );
}

run().catch(async (err) => {
  console.error(
    JSON.stringify({
      event: "migration.crash",
      migration: "order-logistics",
      message: err.message,
    }),
  );
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
