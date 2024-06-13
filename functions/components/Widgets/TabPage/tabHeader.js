import React from "react";

export default function TabHeader({ title, onClick, isSelected }) {

  return (
    <div
      className={`
        text-base py-1 px-4 border-solid border-b-2 mb-6 cursor-pointer
        ${isSelected ?
          'text-primary border-b-primary font-semibold'
          :
          'border-b-base-200 font-light hover:text-secondary hover:border-b-secondary'
        }
      `}
      onClick={onClick}
    >
      {title}
    </div>
  );
}