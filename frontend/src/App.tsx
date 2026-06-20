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
           <Route path="/" element={<Navigate to="/chat" />} />
         </Routes>
         <ToastContainer />
       </Router>
     </ToastProvider>
   );
 };
 
 export default App;
