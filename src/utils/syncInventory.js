import { api } from "../services/api";
import { ACTIONS } from "../reducers/inventoryReducer";

/**
 * Fetch the latest authoritative inventory data (paints, stock, orders) directly from MySQL
 * and update the React application state through the central inventoryReducer.
 */
export async function refreshInventoryData(dispatch) {
  try {
    const [paintsRes, stockRes, ordersRes] = await Promise.all([
      api.get("/api/paints"),
      api.get("/api/stock"),
      api.get("/api/orders")
    ]);

    dispatch({
      type: ACTIONS.LOAD_DATA,
      payload: {
        paints: Array.isArray(paintsRes) ? paintsRes : [],
        stock: Array.isArray(stockRes) ? stockRes : [],
        orders: Array.isArray(ordersRes) ? ordersRes : []
      }
    });
  } catch (err) {
    console.error("Failed to refresh authoritative inventory from MySQL:", err);
  }
}
