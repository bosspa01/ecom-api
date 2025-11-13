const prisma = require('../config/prisma');

// Helper: safely get request context
function getRequestContext(req) {
  try {
    return {
      ip: (req.headers['x-forwarded-for'] || req.ip || '').toString(),
      ua: (req.headers['user-agent'] || '').toString(),
      method: req.method,
      path: req.originalUrl || req.url,
    };
  } catch (_) {
    return undefined;
  }
}

// Helper: pick minimal entity snapshot
function pickSnapshot(entity, entityType) {
  if (!entity) return null;
  try {
    switch (entityType) {
      case 'PRODUCT':
        return {
          title: entity.title,
          price: entity.price,
          quantity: entity.quantity,
          categoryId: entity.categoryId ?? null,
          // keep minimal; do not include timestamps or ids in snapshot
        };
      case 'COUPON':
        return {
          couponCode: entity.couponCode,
          discountType: entity.discountType,
          discountValue: entity.discountValue,
          maxUses: entity.maxUses,
          currentUses: entity.currentUses,
          minimumOrderAmount: entity.minimumOrderAmount ?? null,
          status: entity.status,
          expirationDate: entity.expirationDate,
        };
      case 'USER':
        return {
          email: entity.email,
          role: entity.role,
          enabled: entity.enabled,
        };
      case 'ORDER':
        return {
          orderStatus: entity.orderStatus,
          status: entity.status,
        };
      default:
        return entity;
    }
  } catch (_) {
    return entity;
  }
}

// Helper: build diff of primitive fields
function buildDiff(before = {}, after = {}) {
  const diff = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const ignore = new Set(['id', 'createdAt', 'updatedAt']);
  for (const k of keys) {
    if (ignore.has(k)) continue;
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    const same = JSON.stringify(b) === JSON.stringify(a);
    if (!same) diff[k] = { before: b, after: a };
  }
  return diff;
}

// Minimal admin activity logger (backward compatible)
async function logAdminAction(req, action, entityType = null, entityId = null, meta = null) {
  try {
    if (!req || !req.user) return;
    const { id, role } = req.user;
    if (role !== 'admin' && role !== 'superadmin') return;
    await prisma.adminLog.create({
      data: {
        adminId: Number(id),
        action,
        entityType: entityType || 'GENERAL',
        entityId: entityId ?? null,
        meta: meta ?? null,
      },
    });
  } catch (e) {
    console.log('AdminLog error:', e.message);
  }
}

// Detailed logger: pass before/after to compute diff; auto-includes request context
async function logAdminActionDetailed(req, {
  action,
  entityType = 'GENERAL',
  entityId = null,
  before = null,
  after = null,
  extra = null,
} = {}) {
  try {
    if (!req || !req.user) return;
    const { id, role } = req.user;
    if (role !== 'admin' && role !== 'superadmin') return;

    const beforeSnap = before ? pickSnapshot(before, entityType) : null;
    const afterSnap = after ? pickSnapshot(after, entityType) : null;
    const diff = buildDiff(beforeSnap || {}, afterSnap || {});
    // reduce meta to diff only as requested (no context/snapshots)
    await prisma.adminLog.create({
      data: {
        adminId: Number(id),
        action,
        entityType,
        entityId,
        meta: { diff },
      },
    });
  } catch (e) {
    console.log('AdminLog error:', e.message);
  }
}

module.exports = { logAdminAction, logAdminActionDetailed };
