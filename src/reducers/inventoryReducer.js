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

export const inventoryReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.LOAD_DATA: {
      return {
        ...state,
        paints: action.payload.paints,
        stock: action.payload.stock,
        orders: action.payload.orders
      };
    }

    case ACTIONS.ADD_PAINT: {
      const newPaint = {
        ...action.payload,
        status: getPaintStatus(action.payload.quantity)
      };

      // Automatically create a default stock entry in Warehouse A
      const newStockEntry = {
        paintId: newPaint.id,
        paintName: newPaint.name,
        brand: newPaint.brand,
        warehouse: "Central Warehouse A",
        quantity: newPaint.quantity,
        minQuantity: 15,
        status: getStockStatus(newPaint.quantity, 15)
      };

      const updatedPaints = [...state.paints, newPaint];
      const updatedStock = [...state.stock, newStockEntry];

      // Save to localStorage
      localStorage.setItem("paint_paints", JSON.stringify(updatedPaints));
      localStorage.setItem("paint_stock", JSON.stringify(updatedStock));

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock
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

      // Update associated stock items' name/brand
      const updatedStock = state.stock.map((s) => {
        if (s.paintId === updatedPaintData.id) {
          // If the update action modifies the total quantity directly, update stock proportionally or set Central Warehouse stock
          // Here, we just keep the name, brand, etc., updated.
          // If quantity is updated via Paint List edit, we will adjust Central Warehouse A's quantity for simplicity.
          let newQty = s.quantity;
          if (s.warehouse === "Central Warehouse A") {
            const otherWarehousesQty = state.stock
              .filter((item) => item.paintId === updatedPaintData.id && item.warehouse !== "Central Warehouse A")
              .reduce((sum, item) => sum + item.quantity, 0);
            newQty = Math.max(0, updatedPaintData.quantity - otherWarehousesQty);
          }
          return {
            ...s,
            paintName: updatedPaintData.name,
            brand: updatedPaintData.brand,
            quantity: newQty,
            status: getStockStatus(newQty, s.minQuantity)
          };
        }
        return s;
      });

      localStorage.setItem("paint_paints", JSON.stringify(updatedPaints));
      localStorage.setItem("paint_stock", JSON.stringify(updatedStock));

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock
      };
    }

    case ACTIONS.DELETE_PAINT: {
      const paintId = action.payload;
      const updatedPaints = state.paints.filter((paint) => paint.id !== paintId);
      const updatedStock = state.stock.filter((s) => s.paintId !== paintId);

      localStorage.setItem("paint_paints", JSON.stringify(updatedPaints));
      localStorage.setItem("paint_stock", JSON.stringify(updatedStock));

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock
      };
    }

    case ACTIONS.UPDATE_STOCK: {
      const { paintId, warehouse, quantity, minQuantity } = action.payload;

      // Update the specific stock entry
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

      // Recalculate total quantity for the paint across all warehouses
      const totalQty = updatedStock
        .filter((s) => s.paintId === paintId)
        .reduce((sum, s) => sum + s.quantity, 0);

      // Update that paint's quantity in paints list
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

      localStorage.setItem("paint_paints", JSON.stringify(updatedPaints));
      localStorage.setItem("paint_stock", JSON.stringify(updatedStock));

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock
      };
    }

    case ACTIONS.ADD_ORDER: {
      const newOrder = action.payload;
      const updatedOrders = [newOrder, ...state.orders];

      // Deduct order quantity from warehouse stock
      // Deduct from Central Warehouse A, if not enough deduct from others
      let remainingToDeduct = newOrder.quantity;
      const updatedStock = state.stock.map((s) => {
        if (s.paintId === newOrder.paintId && remainingToDeduct > 0) {
          const deduct = Math.min(s.quantity, remainingToDeduct);
          remainingToDeduct -= deduct;
          const newQty = s.quantity - deduct;
          return {
            ...s,
            quantity: newQty,
            status: getStockStatus(newQty, s.minQuantity)
          };
        }
        return s;
      });

      // Recalculate paint total quantity
      const totalQty = updatedStock
        .filter((s) => s.paintId === newOrder.paintId)
        .reduce((sum, s) => sum + s.quantity, 0);

      const updatedPaints = state.paints.map((p) => {
        if (p.id === newOrder.paintId) {
          return {
            ...p,
            quantity: totalQty,
            status: getPaintStatus(totalQty)
          };
        }
        return p;
      });

      localStorage.setItem("paint_orders", JSON.stringify(updatedOrders));
      localStorage.setItem("paint_paints", JSON.stringify(updatedPaints));
      localStorage.setItem("paint_stock", JSON.stringify(updatedStock));

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock,
        orders: updatedOrders
      };
    }

    case ACTIONS.UPDATE_ORDER_STATUS: {
      const { orderId, newStatus } = action.payload;
      const originalOrder = state.orders.find((o) => o.id === orderId);
      if (!originalOrder) return state;

      const oldStatus = originalOrder.status;

      const updatedOrders = state.orders.map((o) => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      });

      let updatedStock = state.stock;
      let updatedPaints = state.paints;

      // If an order is Cancelled, add the stock back to Central Warehouse A
      if (newStatus === "Cancelled" && oldStatus !== "Cancelled") {
        updatedStock = state.stock.map((s) => {
          if (s.paintId === originalOrder.paintId && s.warehouse === "Central Warehouse A") {
            const newQty = s.quantity + originalOrder.quantity;
            return {
              ...s,
              quantity: newQty,
              status: getStockStatus(newQty, s.minQuantity)
            };
          }
          return s;
        });

        // Recalculate paint total quantity
        const totalQty = updatedStock
          .filter((s) => s.paintId === originalOrder.paintId)
          .reduce((sum, s) => sum + s.quantity, 0);

        updatedPaints = state.paints.map((p) => {
          if (p.id === originalOrder.paintId) {
            return {
              ...p,
              quantity: totalQty,
              status: getPaintStatus(totalQty)
            };
          }
          return p;
        });
      }
      // If a Cancelled order is changed back to something else, deduct it again
      else if (oldStatus === "Cancelled" && newStatus !== "Cancelled") {
        let remainingToDeduct = originalOrder.quantity;
        updatedStock = state.stock.map((s) => {
          if (s.paintId === originalOrder.paintId && s.warehouse === "Central Warehouse A") {
            const deduct = Math.min(s.quantity, remainingToDeduct);
            remainingToDeduct -= deduct;
            const newQty = s.quantity - deduct;
            return {
              ...s,
              quantity: newQty,
              status: getStockStatus(newQty, s.minQuantity)
            };
          }
          return s;
        });

        const totalQty = updatedStock
          .filter((s) => s.paintId === originalOrder.paintId)
          .reduce((sum, s) => sum + s.quantity, 0);

        updatedPaints = state.paints.map((p) => {
          if (p.id === originalOrder.paintId) {
            return {
              ...p,
              quantity: totalQty,
              status: getPaintStatus(totalQty)
            };
          }
          return p;
        });
      }

      localStorage.setItem("paint_orders", JSON.stringify(updatedOrders));
      localStorage.setItem("paint_paints", JSON.stringify(updatedPaints));
      localStorage.setItem("paint_stock", JSON.stringify(updatedStock));

      return {
        ...state,
        paints: updatedPaints,
        stock: updatedStock,
        orders: updatedOrders
      };
    }

    case ACTIONS.RESET: {
      localStorage.removeItem("paint_paints");
      localStorage.removeItem("paint_stock");
      localStorage.removeItem("paint_orders");
      return {
        ...state,
        paints: action.payload.paints,
        stock: action.payload.stock,
        orders: action.payload.orders
      };
    }

    default:
      return state;
  }
};
