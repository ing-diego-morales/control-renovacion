import { createRouter, createWebHistory } from 'vue-router'
import { session } from './auth'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import Rentals from './views/Rentals.vue'
import Customers from './views/Customers.vue'
import Accounts from './views/Accounts.vue'
import Products from './views/Products.vue'
import Categories from './views/Categories.vue'
import Trash from './views/Trash.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login, meta: { public: true, title: 'Iniciar sesión' } },
    { path: '/', component: Dashboard, meta: { title: 'Panel' } },
    { path: '/alquileres', component: Rentals, meta: { title: 'Alquileres' } },
    { path: '/clientes', component: Customers, meta: { title: 'Clientes' } },
    { path: '/cuentas', component: Accounts, meta: { title: 'Cuentas' } },
    { path: '/productos', component: Products, meta: { title: 'Productos' } },
    { path: '/categorias', component: Categories, meta: { title: 'Categorías' } },
    { path: '/papelera', component: Trash, meta: { title: 'Papelera' } },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.public && !session.token)
    return { path: '/login', query: { redirect: to.fullPath } }
  if (to.path === '/login' && session.token) return '/'
})

export default router