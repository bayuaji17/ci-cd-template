import { Hono } from 'hono';
const users = [
    {
        id: 1,
        name: 'Budi Santoso',
        email: 'budi@example.com',
    },
    {
        id: 2,
        name: 'Siti Aminah',
        email: 'siti@example.com',
    },
];
export const usersRoute = new Hono();
usersRoute.get('/users', (c) => {
    return c.json({
        data: users,
    });
});
usersRoute.get('/users/:id', (c) => {
    const id = Number(c.req.param('id'));
    const user = users.find((item) => item.id === id);
    if (!user) {
        return c.json({
            message: 'User not found',
        }, 404);
    }
    return c.json({
        data: user,
    });
});
