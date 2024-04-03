import Swal from './libs/sweetalert2.esm.js'

export const showDimmer = (msg, opts={})=>{
  const contentKey = opts.html ? 'html' : 'text'
  const initSwalOpt = {
    allowEscapeKey: false,
    allowEnterKey: false,
    allowOutsideClick: false,
    showConfirmButton: false
  }
  initSwalOpt[contentKey] = msg || 'processing...'
  Swal.fire(initSwalOpt)
}

export const hideDimmer = ()=>{
  Swal.close()
}
