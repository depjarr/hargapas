import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import { Spinner } from './components/Icon'
import { ForgotPassword, Login, Register } from './pages/AuthPages'
import Dashboard from './pages/Dashboard'
import ProductForm from './pages/ProductForm'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Recommendation from './pages/Recommendation'
import Consultant from './pages/Consultant'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

const Loader = () => <Spinner />

function Protected() {
  const { session, loading } = useAuth()
  if (loading) return <Loader />
  return session ? <Layout /> : <Navigate to="/login" replace />
}

function Public({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Loader />
  return session ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/register" element={<Register />} />
      <Route path="/lupa-password" element={<Public><ForgotPassword /></Public>} />
      <Route path="/reset-password" element={<Navigate to="/lupa-password" replace />} />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="kalkulator" element={<ProductForm />} />
        <Route path="kalkulator/:id" element={<ProductForm />} />
        <Route path="produk" element={<Products />} />
        <Route path="produk/:id" element={<ProductDetail />} />
        <Route path="rekomendasi" element={<Recommendation />} />
        <Route path="konsultan" element={<Consultant />} />
        <Route path="laporan" element={<Reports />} />
        <Route path="pengaturan" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
