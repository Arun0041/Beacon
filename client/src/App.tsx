import { Navigate, Route, Routes } from "react-router-dom";
import Toaster from "./components/Toaster";

import FieldLayout from "./pages/field/FieldLayout";
import Home from "./pages/field/Home";
import MapView from "./pages/field/MapView";
import Chat from "./pages/field/Chat";
import Wiki from "./pages/field/Wiki";
import WikiGuide from "./pages/field/WikiGuide";
import Profile from "./pages/field/Profile";

import DashLayout from "./pages/dash/DashLayout";
import Overview from "./pages/dash/Overview";
import SosTable from "./pages/dash/SosTable";
import Hazards from "./pages/dash/Hazards";
import Shelters from "./pages/dash/Shelters";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<FieldLayout />}>
          <Route index element={<Home />} />
          <Route path="map" element={<MapView />} />
          <Route path="chat" element={<Chat />} />
          <Route path="wiki" element={<Wiki />} />
          <Route path="wiki/:slug" element={<WikiGuide />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/dashboard" element={<DashLayout />}>
          <Route index element={<Overview />} />
          <Route path="sos" element={<SosTable />} />
          <Route path="hazards" element={<Hazards />} />
          <Route path="shelters" element={<Shelters />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
