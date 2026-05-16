const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function check() {
  try {
    const courses = await db.course.findMany();
    console.log('Courses count:', courses.length);
    console.log('Courses:', JSON.stringify(courses.map(c => ({ id: c.id, title: c.title, isPublished: c.isPublished, categoryId: c.categoryId, teacherId: c.teacherId })), null, 2));
    
    const categories = await db.category.findMany();
    console.log('Categories count:', categories.length);
    console.log('Categories:', JSON.stringify(categories, null, 2));
    
    const users = await db.user.findMany();
    console.log('Users count:', users.length);
    console.log('Users:', JSON.stringify(users.map(u => ({ id: u.id, name: u.name, role: u.role })), null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await db.$disconnect();
  }
}

check();
