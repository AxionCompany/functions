/**
 * @name Menu
 * @description A simple horizontal menu component
 * @param {Array} items - Array of items to be displayed in the menu
 * @param {string} items.label - The label to be displayed for the menu item
 * @param {string} items.href - The link to be navigated to when the menu item is clicked
 * @param {string} className - Additional classes to be added to the menu
 */

export default ({ items, className }) => {
  return (
    <ul className={`menu menu-horizontal ${className}`}>
      {items.map((item, index) => (
        <li key={index}>
          <a className="font-sans font-bold text-md" href={item.href}>{item.label}</a>
        </li>
      ))}
    </ul>
  );
};
