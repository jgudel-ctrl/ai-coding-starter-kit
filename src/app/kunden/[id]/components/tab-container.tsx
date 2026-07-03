"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  BarChart3,
  PackageSearch,
  ClipboardList,
} from "lucide-react";

interface TabContainerProps {
  defaultTab?: string;
  children: {
    overview: React.ReactNode;
    revenue: React.ReactNode;
    orders: React.ReactNode;
    defaults: React.ReactNode;
  };
}

export function TabContainer({ defaultTab = "overview", children }: TabContainerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-6 grid w-full grid-cols-4 md:w-auto md:grid-cols-4">
        <TabsTrigger value="overview" className="text-xs sm:text-sm flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-1 sm:px-3">
          <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Übersicht</span>
          <span className="sm:hidden">Übers.</span>
        </TabsTrigger>
        <TabsTrigger value="revenue" className="text-xs sm:text-sm flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-1 sm:px-3">
          <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Umsatz</span>
          <span className="sm:hidden">Ums.</span>
        </TabsTrigger>
        <TabsTrigger value="orders" className="text-xs sm:text-sm flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-1 sm:px-3">
          <PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Bestellhistorie</span>
          <span className="sm:hidden">Best.</span>
        </TabsTrigger>
        <TabsTrigger value="defaults" className="text-xs sm:text-sm flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-1 sm:px-3">
          <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Auftrags-Default</span>
          <span className="sm:hidden">Auftr.</span>
        </TabsTrigger>
      </TabsList>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <TabsContent value="overview" className="mt-0">
              {children.overview}
            </TabsContent>
          </motion.div>
        )}
        {activeTab === "revenue" && (
          <motion.div
            key="revenue"
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <TabsContent value="revenue" className="mt-0">
              {children.revenue}
            </TabsContent>
          </motion.div>
        )}
        {activeTab === "orders" && (
          <motion.div
            key="orders"
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <TabsContent value="orders" className="mt-0">
              {children.orders}
            </TabsContent>
          </motion.div>
        )}
        {activeTab === "defaults" && (
          <motion.div
            key="defaults"
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <TabsContent value="defaults" className="mt-0">
              {children.defaults}
            </TabsContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Tabs>
  );
}
