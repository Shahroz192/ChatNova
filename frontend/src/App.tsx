 import React from "react";
 import {
   BrowserRouter as Router,
   Routes,
   Route,
   Navigate,
 } from "react-router-dom";
 import Login from "./components/auth/Login";
 import Register from "./components/auth/Register";
 import Chat from "./components/chat/Chat";
 import ModelTest from "./components/settings/ModelTest";
 import ProfileEdit from "./components/settings/ProfileEdit";
 import Settings from "./components/settings/Settings";
 import ToastContainer from "./components/common/ToastContainer";
 import RequireAuth from "./components/common/RequireAuth";
 import { ToastProvider } from "./contexts/ToastContext";
 
 const App: React.FC = () => {
   return (
     <ToastProvider>
       <Router>
         <Routes>
           <Route path="/login" element={<Login />} />
           <Route path="/register" element={<Register />} />
           <Route
             path="/chat"
             element={
               <RequireAuth>
                 <Chat />
               </RequireAuth>
             }
           />
           <Route
             path="/model-test"
             element={
               <RequireAuth>
                 <ModelTest />
               </RequireAuth>
             }
           />
           <Route
             path="/profile"
             element={
               <RequireAuth>
                 <ProfileEdit />
               </RequireAuth>
             }
           />
           <Route
             path="/settings"
             element={
               <RequireAuth>
                 <Settings />
               </RequireAuth>
             }
           />
           <Route path="/" element={<Navigate to="/chat" />} />
         </Routes>
         <ToastContainer />
       </Router>
     </ToastProvider>
   );
 };
 
 export default App;
