const express = require("express");
const { authCheck, adminCheck, superAdminCheck } = require("../middlewares/authCheck");
const router = express.Router();

const { getOrdersAdmin, changeOrderStatus, getStripeSales, getTodaySoldCount } = require("../controllers/admin");
const prisma = require('../config/prisma');

// Add route protection middleware in correct order
router.get("/admin/today-sold", authCheck, adminCheck, getTodaySoldCount);
router.put("/admin/order-status", authCheck, adminCheck, changeOrderStatus);
router.get("/admin/orders", authCheck, adminCheck, getOrdersAdmin);
router.get("/admin/stripe-sales", authCheck, adminCheck, getStripeSales);

// Superadmin only: view admin logs
router.get('/admin/logs', authCheck, superAdminCheck, async (req, res) => {
	try {
	let { page = 1, limit = 20, action, adminId, includeMeta } = req.query;
		// Normalize 'undefined' or empty action from query string
		if (action === 'undefined' || action === '') action = undefined;
	const withMeta = String(includeMeta).toLowerCase() === 'true';
		const skip = (Number(page) - 1) * Number(limit);
		const where = {};
		if (action) where.action = action;
		if (adminId) where.adminId = Number(adminId);
		const [rawItems, total] = await Promise.all([
			prisma.adminLog.findMany({
				where,
				include: { admin: { select: { id: true, email: true, name: true } } },
				orderBy: { createdAt: 'desc' },
				skip,
				take: Number(limit)
			}),
			prisma.adminLog.count({ where })
		]);
		// Collect missing labels for batch lookups
		const need = { COUPON: new Set(), PRODUCT: new Set(), USER: new Set(), CATEGORY: new Set() };
		// tiny helper to build diff for legacy logs which stored before/after
		const buildDiff = (before = {}, after = {}) => {
			const diff = {};
			const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
			const ignore = new Set(['id', 'createdAt', 'updatedAt']);
			for (const k of keys) {
				if (ignore.has(k)) continue;
				const b = before ? before[k] : undefined;
				const a = after ? after[k] : undefined;
				if (JSON.stringify(b) !== JSON.stringify(a)) {
					diff[k] = { before: b, after: a };
				}
			}
			return diff;
		};

		const preItems = rawItems.map(item => {
			const meta = item.meta || {};
			let diff = meta.diff || {};
			// Fallback for legacy logs: compute diff from before/after if diff empty
			if ((!diff || Object.keys(diff).length === 0) && (meta.before || meta.after)) {
				diff = buildDiff(meta.before || {}, meta.after || {});
			}
			const before = {}; // snapshots no longer stored
			const after = {};
			let label = undefined;
			switch (item.entityType) {
				case 'COUPON':
					label = (diff.couponCode && (diff.couponCode.after || diff.couponCode.before)) || (meta.after?.couponCode || meta.before?.couponCode) || undefined; break;
				case 'PRODUCT':
					label = (diff.title && (diff.title.after || diff.title.before)) || (meta.after?.title || meta.before?.title) || undefined; break;
				case 'USER':
					label = (diff.email && (diff.email.after || diff.email.before)) || (meta.after?.email || meta.before?.email) || undefined; break;
				case 'CATEGORY':
					label = (diff.name && (diff.name.after || diff.name.before)) || (meta.after?.name || meta.before?.name) || undefined; break;
				default:
					label = undefined;
			}
			if (!label && item.entityId) {
				if (need[item.entityType]) need[item.entityType].add(item.entityId);
			}
			return { item: { ...item, meta: { ...meta, diff } }, label };
		});

		// Batch fetch labels when missing
		const lookups = {};
		if (need.COUPON.size) {
			const rows = await prisma.saleCoupon.findMany({ where: { id: { in: Array.from(need.COUPON) } }, select: { id: true, couponCode: true } });
			lookups.COUPON = Object.fromEntries(rows.map(r => [r.id, r.couponCode]));
		}
		if (need.PRODUCT.size) {
			const rows = await prisma.product.findMany({ where: { id: { in: Array.from(need.PRODUCT) } }, select: { id: true, title: true } });
			lookups.PRODUCT = Object.fromEntries(rows.map(r => [r.id, r.title]));
		}
		if (need.USER.size) {
			const rows = await prisma.user.findMany({ where: { id: { in: Array.from(need.USER) } }, select: { id: true, email: true } });
			lookups.USER = Object.fromEntries(rows.map(r => [r.id, r.email]));
		}
		if (need.CATEGORY.size) {
			const rows = await prisma.category.findMany({ where: { id: { in: Array.from(need.CATEGORY) } }, select: { id: true, name: true } });
			lookups.CATEGORY = Object.fromEntries(rows.map(r => [r.id, r.name]));
		}

		const items = preItems.map(({ item, label }) => {
			let finalLabel = label;
			if (!finalLabel && item.entityId) {
				const map = lookups[item.entityType] || {};
				finalLabel = map[item.entityId] || `#${item.entityId}`;
			}
			if (!finalLabel && item.entityId) finalLabel = `#${item.entityId}`;
			return {
				id: item.id,
				createdAt: item.createdAt,
				action: item.action,
				admin: item.admin,
				entityType: item.entityType,
				entityId: item.entityId,
				label: finalLabel,
				// Temporarily always include meta for troubleshooting diff visibility
				meta: item.meta || null
			};
		});

		// Debug: log first item meta shape when requested with includeMeta
		if (items.length && withMeta) {
			console.log('AdminLogs debug sample meta:', JSON.stringify(items[0].meta));
		}
		res.json({ page: Number(page), limit: Number(limit), total, items });
	} catch (e) {
		console.log(e);
		res.status(500).json({ message: 'Failed to fetch admin logs' });
	}
});

module.exports = router;
