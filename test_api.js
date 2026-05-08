import axios from 'axios';
import { prisma } from './src/app/prisma.js';
import jwt from 'jsonwebtoken';

async function test() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log("No user");
  console.log("Found user:", user.email);

  // create a valid JWT token
  const token = jwt.sign(
      { id: user.id, tenantId: user.tenantId, role: "Admin", unitId: user.unitId }, 
      process.env.JWT_SECRET || 'supersecretjwtkeyforerpsystem'
  );

  try {
      const res = await axios.get('http://localhost:3000/api/v1/hr/roles', {
          headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Success:", res.status);
  } catch(e) {
      console.error("Failed:", e.response?.status, e.response?.data);
  } finally {
      prisma.$disconnect();
  }
}

test();
