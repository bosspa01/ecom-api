const SHIPPING_OPTIONS = {
  bangkok_standard: {
    id: 'bangkok_standard',
    name: 'กรุงเทพและปริมณฑล - ธรรมดา',
    cost: 35,
    region: 'bangkok',
    speed: 'standard'
  },
  bangkok_express: {
    id: 'bangkok_express',
    name: 'กรุงเทพและปริมณฑล - แบบเร็ว',
    cost: 50,
    region: 'bangkok',
    speed: 'express'
  },
  province_standard: {
    id: 'province_standard',
    name: 'ต่างจังหวัด - ธรรมดา',
    cost: 50,
    region: 'province',
    speed: 'standard'
  },
  province_express: {
    id: 'province_express',
    name: 'ต่างจังหวัด - แบบเร็ว',
    cost: 75,
    region: 'province',
    speed: 'express'
  }
};

const getShippingCost = (shippingMethod) => {
  return SHIPPING_OPTIONS[shippingMethod]?.cost || 35;
};

const getShippingName = (shippingMethod) => {
  return SHIPPING_OPTIONS[shippingMethod]?.name || 'ไม่ระบุ';
};

module.exports = {
  SHIPPING_OPTIONS,
  getShippingCost,
  getShippingName
};
