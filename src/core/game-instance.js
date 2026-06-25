var gameInstance=null;

function activeGameScene(){
  return gameInstance?.scene?.getScene?.('Game')||gameInstance?.scene?.scenes?.[0]||null;
}

function eventElement(e){
  return e?.target instanceof Element?e.target:e?.target?.parentElement||null;
}
