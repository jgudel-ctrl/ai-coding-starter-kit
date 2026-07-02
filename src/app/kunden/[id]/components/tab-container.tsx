"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TabContainerProps {
  defaultTab?: string;
  children: {
    overview: React.ReactNode;
    revenue: React.ReactNode;
    orders: React.ReactNode;
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
      <TabsList className="mb-6 grid w-full grid-cols-3 md:w-auto">
        <TabsTrigger value="overview" className="text-sm">
          Übersicht
        </TabsTrigger>
        <TabsTrigger value="revenue" className="text-sm">
          Umsatz
        </TabsTrigger>
        <TabsTrigger value="orders" className="text-sm">
          Bestellhistorie
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
      </AnimatePresence>
    </Tabs>
  );
}
