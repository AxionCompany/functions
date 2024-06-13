import React from 'react'

function LoadingModal({ id, title, message }) {
  return (
    <>
      <input type="checkbox" id={id} className="modal-toggle" />
      <div className="modal">
        <div className="modal-box relative">
            <h3 className="text-ls font-bold">{title}</h3>
            <p className="py-4">{message}</p>
        </div>
      </div>
    </>
  )
}

export default LoadingModal