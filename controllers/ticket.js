const prisma = require("../config/prisma");

// Create a new ticket
exports.createTicket = async (req, res) => {
  try {
    // log incoming body for debugging
    console.log('createTicket body:', req.body);
    const { title, message } = req.body;
    const userId = req.user.id;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    let ticket;
    if (message && message.trim()) {
      // create ticket with initial message in a transaction
      ticket = await prisma.$transaction(async (prismaTx) => {
        const t = await prismaTx.ticket.create({
          data: {
            title,
            userId,
          },
        });
        await prismaTx.message.create({
          data: {
            content: message,
            ticketId: t.id,
            userId,
          },
        });
        return prismaTx.ticket.findUnique({
          where: { id: t.id },
          include: {
            user: { select: { id: true, name: true, email: true } },
            messages: { include: { user: { select: { id: true, email: true } } } },
          },
        });
      });
    } else {
      ticket = await prisma.ticket.create({
        data: {
          title,
          userId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          messages: { include: { user: { select: { id: true, email: true } } } },
        },
      });
    }

    res.status(201).json(ticket);
  } catch (error) {
    // Log full error server-side for diagnosis
    console.error("Create ticket error:", error);
    // In development, include error details in response to help debugging.
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ message: "Failed to create ticket", error: error.message });
    }
    res.status(500).json({ message: "Failed to create ticket" });
  }
};

// Get tickets for current user
exports.getUserTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const tickets = await prisma.ticket.findMany({
      where: {
        userId,
      },
      include: {
        messages: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json(tickets);
  } catch (error) {
    console.error("Get user tickets error:", error);
    res.status(500).json({ message: "Failed to get tickets" });
  }
};

// Get all tickets (admin only)
exports.getAdminTickets = async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        messages: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json(tickets);
  } catch (error) {
    console.error("Get admin tickets error:", error);
    res.status(500).json({ message: "Failed to get tickets" });
  }
};

// Add message to ticket
exports.addMessage = async (req, res) => {
  try {
    const { ticketId, content } = req.body;
    const userId = req.user.id;

    const message = await prisma.message.create({
      data: {
        content,
        ticketId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Update ticket's updatedAt
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    res.json(message);
  } catch (error) {
    console.error("Add message error:", error);
    res.status(500).json({ message: "Failed to add message" });
  }
};

// Close ticket (admin only)
exports.closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await prisma.ticket.update({
      where: {
        id: parseInt(ticketId),
      },
      data: {
        status: "CLOSED",
      },
    });

    res.json(ticket);
  } catch (error) {
    console.error("Close ticket error:", error);
    res.status(500).json({ message: "Failed to close ticket" });
  }
};

// Get messages for a specific ticket
exports.getTicketMessages = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    // Verify access: either owner or admin
    const ticket = await prisma.ticket.findUnique({ where: { id: parseInt(ticketId) } });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (!isAdmin && ticket.userId !== userId) {
      return res.status(403).json({ message: 'Access denied to this ticket' });
    }

    const messages = await prisma.message.findMany({
      where: { ticketId: parseInt(ticketId) },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (error) {
    console.error('Get ticket messages error:', error);
    res.status(500).json({ message: 'Failed to get messages', error: error.message });
  }
};

// Get single ticket details
exports.getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    const ticket = await prisma.ticket.findUnique({
      where: { id: parseInt(ticketId) },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (!isAdmin && ticket.userId !== userId) {
      return res.status(403).json({ message: 'Access denied to this ticket' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Failed to get ticket', error: error.message });
  }
};