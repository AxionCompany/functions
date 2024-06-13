import React, { useState, useEffect } from "react";
import { isElement } from "react-dom/test-utils";
import TabHeader from "./tabHeader";

export default function TabPage({ children, companyId, router, activeTab }) {
  const [childrenKey, setChildrenKey] = useState(parseInt(activeTab) || 0);

  useEffect(() => {
    router.push(`${companyId}?tab=${childrenKey}`, undefined, {
      shallow: true,
    });
  }, [childrenKey]);

  return (
    <div className="h-full">
      <div className="flex">
        {children.length > 1 ? (
          children.map((c, index) => {
            if (c.props?.title) {
              return (
                <TabHeader
                  key={index}
                  title={c.props.title}
                  onClick={() => setChildrenKey(index)}
                  isSelected={index === childrenKey}
                />
              );
            } else {
              return <></>;
            }
          })
        ) : (
          <TabHeader
            key={"0"}
            title={children.props.title}
            onClick={() => setChildrenKey("0")}
            isSelected={true}
          />
        )}
      </div>
      <div>{children[childrenKey]}</div>
    </div>
  );
}
