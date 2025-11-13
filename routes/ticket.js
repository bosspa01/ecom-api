const express = require("express");
const { authCheck, adminCheck } = require("../middlewares/authCheck");
const router = express.Router();

const {
  createTicket,
  getUserTickets,
  getAdminTickets,
  addMessage,
  closeTicket,
  getTicketMessages,
  getTicket,
} = require("../controllers/ticket");

// User routes
router.post("/ticket", authCheck, createTicket);
router.get("/user/tickets", authCheck, getUserTickets);
router.post("/ticket/message", authCheck, addMessage);
router.get('/ticket/:ticketId/messages', authCheck, getTicketMessages);
router.get('/ticket/:ticketId', authCheck, getTicket);

// Admin routes
router.get("/admin/tickets", authCheck, adminCheck, getAdminTickets);
router.put("/admin/ticket/:ticketId/close", authCheck, adminCheck, closeTicket);

module.exports = router;