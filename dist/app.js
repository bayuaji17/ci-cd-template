import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';
import { usersRoute } from './routes/users.js';
export const app = new Hono();
app.get('/', (c) => {
    return c.json({
        message: 'Hello Hono!',
    });
});
app.route('/', healthRoute);
app.route('/api', usersRoute);
