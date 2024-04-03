const client_id = 'd9de663c-0a36-4cb8-ad88-9a5c879d95f4';
var odOptions = {
  clientId: client_id,
  action: "save",
//  action: "query",
  sourceInputElementId: "file-input",
  sourceUri: "",
  fileName: "file.txt",
  openInNewWindow: false,
  advanced: {},
  success: function(files) { /* success handler */ },
  progress: function(percent) { /* progress handler */ },
  cancel: function() { /* cancel handler */ },
  error: function(error) { /* error handler */
    console.log('eeeeeee', error, arguments)
  }
}


  function launchSaveToOneDrive(){
    OneDrive.save(odOptions);
  }


document.querySelector('.submit-file-btn').onclick = ()=>{
  OneDrive.save(odOptions);
}
