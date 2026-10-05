import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ConfigurationPage } from '../features/configuration/ConfigurationPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { AssetDetailPage } from '../features/inventory/AssetDetailPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { RegisterAssetPage } from '../features/inventory/RegisterAssetPage'
import { LabelsPage } from '../features/labels/LabelsPage'
import { PrintLabelsPage } from '../features/labels/PrintLabelsPage'
import { QrCodeRedirectPage } from '../features/labels/QrCodeRedirectPage'
import { LoginPage } from '../pages/LoginPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ScanPage } from '../pages/ScanPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/restablecer-clave" element={<ResetPasswordPage />} />
    <Route element={<RequireAuth><AppShell /></RequireAuth>}>
      <Route index element={<DashboardPage />} />
      <Route path="inventario" element={<InventoryPage />} />
      <Route path="inventario/nuevo" element={<RegisterAssetPage />} />
      <Route path="inventario/:assetId" element={<AssetDetailPage />} />
      <Route path="etiquetas" element={<LabelsPage />} />
      <Route path="etiquetas/:batchId/imprimir" element={<PrintLabelsPage />} />
      <Route path="q/:code" element={<QrCodeRedirectPage />} />
      <Route path="recorridos" element={<PlaceholderPage title="Recorridos" description="La verificación física por dependencia se incorporará en una fase posterior." />} />
      <Route path="pendientes" element={<PlaceholderPage title="Pendientes" description="Se activará progresivamente a medida que incorporemos fotografías, verificaciones y otros controles." />} />
      <Route path="configuracion" element={<ConfigurationPage />} />
      <Route path="escanear" element={<ScanPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
