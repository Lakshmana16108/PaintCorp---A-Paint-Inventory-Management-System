// Reducer action types
export const ACTIONS = {
  LOAD_DATA: "LOAD_DATA",
  ADD_PAINT: "ADD_PAINT",
  UPDATE_PAINT: "UPDATE_PAINT",
  DELETE_PAINT: "DELETE_PAINT",
  UPDATE_STOCK: "UPDATE_STOCK",
  ADD_ORDER: "ADD_ORDER",
  UPDATE_ORDER_STATUS: "UPDATE_ORDER_STATUS",
  RESET: "RESET"
};

// Utility to calculate paint status based on total quantity
const getPaintStatus = (qty) => {
  if (qty <= 0) return "Out of Stock";
  if (qty <= 15) return "Low Stock";
  return "In Stock";
};

// Utility to calculate stock entry status based on minimum quantity
const getStockStatus = (qty, minQty) => {
  if (qty <= 0) return "Out of Stock";
  if (qty <= minQty) return "Low Stock";
  return "In Stock";
};

const ORDERS_STORAGE_KEY = "paintcorp_active_orders";

const getSavedOrders = () => {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const saveOrders = (orders) => {
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {}
};

const sortOrdersDesc = (orderList) => {
  return [...orderList].sort((a, b) => {
    const dateA = String(a.date || a.order_date || a.created_at || a.createdAt || "");
    const dateB = String(b.date || b.order_date || b.created_at || b.createdAt || "");
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
};

export const inventoryReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.LOAD_DATA: {
      const serverOrders = Array.isArray(action.payload.orders) ? action.payload.orders : [];
      const serverOrderIds = new Set(serverOrders.map((o) => o.id));

      const storedOrders = getSavedOrders();
      const currentOrders = Array.isArray(state.orders) ? state.orders : [];

      // Preserve any client-created orders that the server response does not have yet
      const localCandidateMap = new Map();
      [...currentOrders, ...storedOrders].forEach((o) => {
        if (o && o.id && !serverOrderIds.has(o.id) && !localCandidateMap.has(o.id)) {
          localCandidateMap.set(o.id, o);
        }
      });

      const localOnlyOrders = Array.from(localCandidateMap.values());
      const mergedOrders = sortOrdersDesc([...localOnlyOrders, ...serverOrders]);
      saveOrders(mergedOrders);

      return {
        ...state,
        paints: action.payload.paints !== undefined ? action.payload.paints : state.paints,
        stock: action.payload.stock !== undefined ? action.payload.stock : state.stock,
        orders: mergedOrders
      };
    }

    case ACTIONS.ADD_PAINT: {
      const newPaint = {
        ...action.payload,
        status: getPaintStatus(action.payload.quantity)
      };

      const newStockEntry = {
        paintId: newPaint.id,
        paintName: newPaint.name,
        brand: newPaint.brand,
        warehouse: "Central Warehouse - Tirunelveli",
        quantity: newPaint.quantity,
        minQuantity: 15,
        status: getStockStatus(newPaint.quantity, 15)
      };

      return {
        ...state,
        paints: [...state.paints, newPaint],
        stock: [...state.stock, newStockEntry]
      };
    }

    case ACTIONS.UPDATE_PAINT: {
      const updatedPaintData = action.payload;
      const updatedPaints = state.paints.map((paint) => {
        if (paint.id === updatedPaintData.id) {
          return {
            ...paint,
            ...updatedPaintData,
            status: getPaintStatus(updatedPaintData.quantity)
          };
        }
        return paint;
      });

      const updatedStock = state.stock.map((s) => {
        if (s.paintId === updatedPaintData.id) {
          return {
            ...s,
            paintName: updatedPaintData.name,
            brand: updatedPaintData.brand
          };
        }
        return s;
      });

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock
      };
    }

    case ACTIONS.DELETE_PAINT: {
      const paintId = action.payload;
      return {
        ...state,
        paints: state.paints.filter((paint) => paint.id !== paintId),
        stock: state.stock.filter((s) => s.paintId !== paintId)
      };
    }

    case ACTIONS.UPDATE_STOCK: {
      const { paintId, warehouse, quantity, minQuantity } = action.payload;

      const updatedStock = state.stock.map((s) => {
        if (s.paintId === paintId && s.warehouse === warehouse) {
          const qty = parseInt(quantity, 10) || 0;
          const minQty = parseInt(minQuantity, 10) || 0;
          return {
            ...s,
            quantity: qty,
            minQuantity: minQty,
            status: getStockStatus(qty, minQty)
          };
        }
        return s;
      });

      const totalQty = updatedStock
        .filter((s) => s.paintId === paintId)
        .reduce((sum, s) => sum + s.quantity, 0);

      const updatedPaints = state.paints.map((p) => {
        if (p.id === paintId) {
          return {
            ...p,
            quantity: totalQty,
            status: getPaintStatus(totalQty)
          };
        }
        return p;
      });

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock
      };
    }

    case ACTIONS.ADD_ORDER: {
      const newOrder = action.payload;
      const filteredExisting = (state.orders || []).filter((o) => o.id !== newOrder.id);
      const updatedOrders = [newOrder, ...filteredExisting];
      saveOrders(updatedOrders);

      // Deduct purchased paint quantities from client state
      const orderItems = Array.isArray(newOrder.items) && newOrder.items.length > 0
        ? newOrder.items
        : [{ paintId: newOrder.paintId, quantity: newOrder.quantity || 1 }];

      const deductMap = {};
      orderItems.forEach((it) => {
        if (it.paintId) {
          deductMap[it.paintId] = (deductMap[it.paintId] || 0) + (Number(it.quantity) || 1);
        }
      });

      const updatedPaints = (state.paints || []).map((p) => {
        if (deductMap[p.id]) {
          const newQty = Math.max(0, p.quantity - deductMap[p.id]);
          return {
            ...p,
            quantity: newQty,
            status: getPaintStatus(newQty)
          };
        }
        return p;
      });

      const updatedStock = (state.stock || []).map((s) => {
        if (deductMap[s.paintId]) {
          const newQty = Math.max(0, s.quantity - deductMap[s.paintId]);
          return {
            ...s,
            quantity: newQty,
            status: getStockStatus(newQty, s.minQuantity || 15)
          };
        }
        return s;
      });

      return {
        ...state,
        orders: updatedOrders,
        paints: updatedPaints,
        stock: updatedStock
      };
    }

    case ACTIONS.UPDATE_ORDER_STATUS: {
      const { orderId, newStatus } = action.payload;
      const updatedOrders = (state.orders || []).map((o) => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      });
      saveOrders(updatedOrders);

      return {
        ...state,
        orders: updatedOrders
      };
    }

    case ACTIONS.RESET: {
      return {
        ...state,
        paints: action.payload?.paints || [],
        stock: action.payload?.stock || [],
        orders: action.payload?.orders || []
      };
    }

    default:
      return state;
  }
};
