class srvDesktop{
  /* ==== INFOS ====
    Regeln:
      Properties? → initProperties()
      DOM-Element? → initElements()
      Laufzeitwert? → initState()
      Event? → initEvents()
      Darstellung? → render...()
      Logik? → eigene Methode (goto(), pointerMove(), next() usw.)
  */
  // ==== Constructor ====
  constructor(options={}){
    this.initProperties(options);
    this.initElements();
    this.initEvents();
    this.init();
  }
  // ==== Initialisierung ====
  initProperties(options){
    this.options={ // Benutzereinstellungen
      animation:350,
      threshold:.25,
      drag:true,
      arrows:true,
      keyboard:true,
      scaleEffect:true,
      rubberBand:true,
      rubberFactor:.35,
      shadowEffect:true,
      roundCorners:true,
      momentum:true,
      parallax:false,
      scaleDrag:.985,
      debugging:true,
      viewport:"#srvDesktopViewport",
      workspace:"#srvDesktopWorkspace",
      dots:"#srvDesktopDots",
      title:"#srvDesktopTitle",
      ...options // Spread-Operator statt wie unten Object.assign(this.options,options); nutzen zu müssen
    };
    //Object.assign(this.options,options);
    this.state={ // Laufzeitdaten
      current:0,
      dragging:false,
      lock:false,
      pointerStartX:0,
      pointerCurrentX:0,
      dragOffset:0,
      velocity:0,
      lastPointerX:0,
      lastMoveTime:0,
      //viewportWidth:this.viewport.clientWidth,
      transition:true,
      viewportWidth:0,
      dirty:{
        workspace:true,
        title:true,
        dots:true,
        effects:true,
        animation:true
      }
    };
    this.listeners={}; // Eventsystem
    this.bound = {}; // gebundene Eventhandler
    //this.desktop_stuff = {}
  }
  initElements(){
    if(this.options.debugging){ console.log('@initElements'); }
    this.viewport  = document.querySelector(this.options.viewport);
    if(!this.viewport){ throw new Error("Viewport nicht gefunden."); }
    this.state.viewportWidth = this.viewport.clientWidth;
    this.workspace = document.querySelector(this.options.workspace);
    if(!this.workspace){ throw new Error("Workspace nicht gefunden."); }
    this.dots      = document.querySelector(this.options.dots);
    if(!this.dots){ throw new Error("Dots nicht gefunden."); }
    this.title     = document.querySelector(this.options.title);
    if(!this.title){ throw new Error("Titel nicht gefunden."); }
    this.arrowLeft = document.querySelector("#srvDesktopArrowLeft");
    if(!this.arrowLeft){ throw new Error("ArrowLeft nicht gefunden."); }
    this.arrowRight = document.querySelector("#srvDesktopArrowRight");
    if(!this.arrowRight){ throw new Error("ArrowRight nicht gefunden."); }
  }
  init(){
    if(this.options.debugging){ console.log('@init'); }
    this.collectDesktopData();
    this.createDots();
    this.render();
    this.emit("ready",this);
  }
  initEvents(){
    if(this.options.debugging){ console.log('@initEvents'); }
    this.bindKeyboard();
    this.bindDragging();
    this.bindArrows();
    this.bindResize();
  }
  // wird später ergänzt
  // ==== Navigation ====
  goto(index){
    if(this.options.debugging){ console.log('@goto'); }
    
    //console.log( "goto() at start",{ current: this.state.current, index } );
    if(typeof index==="string"){ index = this.desktops.findIndex(d => d.name === index); }
    if(index < 0){ index = this.desktops.length - 1; }
    if(index >= this.desktops.length){ index = 0; }
    if(index===this.state.current){ return true; }
    if(this.state.lock || this.desktops.length == 0){ return false; }
    if(index == -1){ index = this.desktops.length - 1; }
    const oldDesktop = this.current();
    this.emit("beforeChange", oldDesktop, index);
    oldDesktop.visible = false;
    this.state.current=index;
    this.state.dirty.workspace=true;
    this.state.dirty.title=true;
    this.state.dirty.dots=true;
    const desktop = this.current();
    desktop.visible = true;
    if(!desktop.opened){
      desktop.opened = true;
      this.emit("firstOpen", desktop);
    }
    if(!desktop.prepared){
      desktop.prepared = true;
      this.emit("prepare", desktop);
    } // um später desktop.on("prepare",(desktop)=>{ loadProviderData(); }); schreiben zu können
    if(!desktop.rendered){
      desktop.rendered = true;
      this.emit("firstRender", desktop);
    } 
    //console.log("goto render vor render()",{current: this.state.current,index});
    this.render(); // statt --> this.update();
    this.emit("change", oldDesktop, desktop);
    return true;
  }
  next(){ 
    if(this.options.debugging){ console.log('@next'); }
    this.goto(this.state.current+1); }
  previous(){ 
    if(this.options.debugging){ console.log('@previous'); }
    this.goto(this.state.current-1); }
  isFirst(){ 
    if(this.options.debugging){ console.log('@isFirst'); }
    return this.currentIndex()==0; }
  first(){ 
    if(this.options.debugging){ console.log('@first'); }
    this.goto(0); }
  last(){ 
    if(this.options.debugging){ console.log('@last'); }
    this.goto(this.desktops.length - 1); }
  isLast(){ 
    if(this.options.debugging){ console.log('@isLast'); }
    return this.currentIndex()==this.desktops.length-1; }
  current(){ 
    if(this.options.debugging){ console.log('@current'); }
    return this.desktops[this.state.current]; }
  currentIndex(){ 
    if(this.options.debugging){ console.log('@currentIndex'); }
    return this.state.current; }
  currentName(){ 
    if(this.options.debugging){ console.log('@currentName'); }
    return this.current().name; }
  currentId(){ 
    if(this.options.debugging){ console.log('@currentId'); }
    return this.current().id; }
  destroy(){
    if(this.options.debugging){ console.log('@destroy'); }
    this.viewport.removeEventListener("pointerdown",this.bound.pointerDown);
    this.viewport.removeEventListener("pointermove",this.bound.pointerMove);
    this.viewport.removeEventListener("pointerup",this.bound.pointerUp);
    this.viewport.removeEventListener("pointercancel",this.bound.pointerCancel);
    this.listeners = {};
  }
  // ==== Rendering ====
  render(){
    if(this.options.debugging){ console.log('@render'); }
    this.renderAnimation();
    //if(this.state.dirty.animation){ this.renderAnimation(); }
    if(this.state.dirty.workspace){
      this.renderWorkspace();
      this.state.dirty.workspace = false;
    }
    if(this.state.dirty.title){
      this.renderTitle();
      this.state.dirty.title = false;
    }
    if(this.state.dirty.dots){
      this.renderDots();
      this.state.dirty.dots = false;
    }
    this.renderEffects();
    //if(this.state.dirty.effects){ this.renderEffects(); }
    //this.clearDirty();
  }
  clearDirty(){ 
    if(this.options.debugging){ console.log('@clearDirty'); }
    Object.keys(this.state.dirty).forEach(key=>{ this.state.dirty[key]=false; }); }
  renderWorkspace(){
    if(this.options.debugging){ console.log('@renderWorkspace'); }
    const x = -(this.currentIndex()*this.state.viewportWidth) + this.state.dragOffset;
    //console.log({"function":"renderWorkspace",current: this.currentIndex(),width: this.state.viewportWidth,offset: this.state.dragOffset,x});
    this.workspace.style.transform = `translateX(${x}px)`;
    //console.log("this.workspace.style.transform:",this.workspace.style.transform);
  }
  renderAnimation(){ 
    if(this.options.debugging){ console.log('@renderAnimation'); }
    this.workspace.style.transition = "transform "+this.options.animation+"ms cubic-bezier(.22,.61,.36,1)"; }
  renderTitle(){
    if(this.options.debugging){ console.log('@renderTitle'); }
    if(!this.title){ return; }
    this.title.textContent = this.desktops[this.state.current].name;
  }
  renderDots(){
    if(this.options.debugging){ console.log('@renderDots'); }
    //console.log({"function":"renderDots",current: this.currentIndex(),stateCurrent: this.state.current,desktops: this.desktops.length});
    if(!this.dots){ return; }
    [...this.dots.children].forEach((dot,index)=>{
      dot.classList.toggle("active",index===this.state.current);
    });
  }
  createDots(){
    if(this.options.debugging){ console.log('@createDots'); }
    this.dots.innerHTML="";
    this.desktops.forEach((desktop,index)=>{
      const dot=document.createElement("button");
      dot.className="srvDesktopDot";
      dot.title=desktop.name;
      dot.addEventListener("click",()=>{ this.goto(index); });
      this.dots.appendChild(dot);
    });
  }
  renderEffects(){
    if(this.options.debugging){ console.log('@renderEffects'); }
    if(this.options.shadowEffect){ this.workspace.classList.add("shadow");
    }else{ this.workspace.classList.remove("shadow"); }
    if(this.options.roundCorners){ this.workspace.classList.add("rounded");
    }else{ this.workspace.classList.remove("rounded"); }
    if(!this.options.scaleEffect){ return; }
    let scale = 1;
    if(this.state.dragging){
      const ratio = Math.min( Math.abs(this.state.dragOffset) / this.state.viewportWidth,1 );
      scale = 1 - ratio * (1-this.options.scaleDrag);
    }
    this.current().element.style.transform = `scale(${scale})`;
    if(!this.options.parallax){ return; }
    const current = this.currentIndex();
    const factor = 0.15;
    this.desktops.forEach((desktop,index)=>{
      let x = 0;
      if(index < current){ x = factor * this.state.dragOffset; }
      else if(index > current){ x = factor * this.state.dragOffset; }
      desktop.element.style.backgroundPositionX = `${x}px`;
    });
  }
  // createCharts();
  // loadProviderData();
  // loadStatistics();
  // ==== Pointer ====
  pointerDown(event){
    if( event.target.closest(".srvDesktopDot") || event.target.closest("#srvDesktopArrowLeft") || event.target.closest("#srvDesktopArrowRight") ){ return; }
    if(this.options.debugging){ console.log('@pointerDown'); }
    //console.log("this.viewport.setPointerCapture(event.pointerId):",this.viewport.setPointerCapture(event.pointerId));
    //console.log("DOWN",{type:event.pointerType,id:event.pointerId,x:event.clientX,y:event.clientY,primary:event.isPrimary});
    this.viewport.setPointerCapture(event.pointerId)
    if(!this.options.drag || this.state.lock){ return; }
    this.state.dragging = true;
    this.state.transition = false;
    this.state.pointerStartX = event.clientX;
    this.state.pointerCurrentX = event.clientX;
    this.state.lastPointerX = event.clientX;
    this.state.lastMoveTime = performance.now();
    this.state.velocity = 0;
    this.state.dragOffset = 0;
    this.workspace.style.transition = "none";
    this.emit("dragStart", event);
    //this.renderAnimation();
  }
  pointerUp(event){
    if(this.options.debugging){ console.log('@pointerUp'); }
    //console.log("UP",{x:event.clientX,y:event.clientY});
    this.viewport.releasePointerCapture(event.pointerId);
    if(!this.state.dragging){ return; }
    this.state.dragging = false;
    this.render();
    this.state.transition = true;
    this.workspace.style.transition = "";
    const velocityThreshold = 0.65;
    if(this.options.momentum){
      if(this.state.velocity > velocityThreshold){
        this.state.dragOffset = 0;
        this.previous();
        return;
      }
      if(this.state.velocity < -velocityThreshold){
        this.state.dragOffset = 0;
        this.next();
        return;
      }
    }
    const threshold = this.state.viewportWidth * this.options.threshold;
    if(this.state.dragOffset > threshold){ 
      this.state.dragOffset = 0;
      this.previous();
    }else if(this.state.dragOffset < -threshold){ 
      this.state.dragOffset = 0;
      this.next();
    }else{ 
      this.state.dragOffset = 0; 
      this.render(); 
    }
    this.state.dragOffset = 0;
    this.emit("dragEnd");
    this.renderAnimation();
  }
  pointerMove(event){
    //if(this.options.debugging){ console.log('@pointerMove'); }
    //console.log("pointer_move:",event.pointerType,event.clientX,event.clientY,event.isPrimary);
    //console.log("MOVE",{x:event.clientX,y:event.clientY});
    if(!this.state.dragging){ return; }
    event.preventDefault();
    const now = performance.now();
    const dx = event.clientX - this.state.lastPointerX;
    const dt = now - this.state.lastMoveTime;
    if(dt>0){ this.state.velocity = dx/dt; }
    this.state.lastPointerX = event.clientX;
    this.state.lastMoveTime = now;
    this.state.pointerCurrentX = event.clientX;
    let offset = this.state.pointerCurrentX - this.state.pointerStartX;
    if(this.options.rubberBand){
      const first = this.currentIndex() === 0;
      const last = this.currentIndex() === this.desktops.length-1;
      if(first && offset > 0){ offset *= this.options.rubberFactor; }
      if(last && offset < 0){ offset *= this.options.rubberFactor; }
    }
    this.state.dragOffset = offset;
    this.state.dirty.workspace = true;
    this.render();
  }
  pointerCancel(event){
    if(this.options.debugging){ console.log('@pointerCancel'); }
    //console.log("CANCEL",event);
    this.state.dragging = false;
    this.state.dragOffset = 0;
  }
  setDragOffset(offset){
    if(this.options.debugging){ console.log('@setDragOffset'); }
    this.state.dragOffset = offset;
    this.render();
  }
  // ==== Animation ====
  // ==== Eventsystem ====
  on(event, callback){
    if(this.options.debugging){ console.log('@on'); }
    if(typeof callback!=="function"){ return this; }
    if(!this.listeners[event]){ this.listeners[event] = []; }
    this.listeners[event].push(callback);
    return this;
  }
  off(event, callback){
    if(this.options.debugging){ console.log('@off'); }
    if(!this.listeners[event]){ return this; }
    this.listeners[event] = this.listeners[event].filter(fn=>fn!==callback);
    return this;
  }
  emit(event,...args){
    if(this.options.debugging){ console.log('@emit'); }
    if(!this.listeners[event]){ return; }
    this.listeners[event].forEach(callback=>{ callback(...args); });
    console.log('@emit');
    
  }
  // ==== Event Binding ====
  bindKeyboard(){
    if(this.options.debugging){ console.log('@bindKeyboard'); }
    if(!this.options.keyboard){ return; }
    window.addEventListener("keydown",(event)=>{
      switch(event.key){
        case "ArrowLeft": this.previous(); break;
        case "ArrowRight": this.next(); break;
      }
    });
  }
  bindDragging(){
    if(this.options.debugging){ console.log('@bindDragging'); }
    if(!this.options.drag){ return; }
    this.bound.pointerDown = this.pointerDown.bind(this);
    this.bound.pointerMove = this.pointerMove.bind(this);
    this.bound.pointerUp = this.pointerUp.bind(this);
    this.bound.pointerCancel = this.pointerCancel.bind(this);
    this.viewport.addEventListener("pointerdown", this.bound.pointerDown);
    this.viewport.addEventListener("pointermove", this.bound.pointerMove,{ passive: false });
    this.viewport.addEventListener("pointerup", this.bound.pointerUp,{ passive: false });
    this.viewport.addEventListener("pointercancel",this.bound.pointerCancel);
  }
  bindArrows(){
    if(this.options.debugging){ console.log('@bindArrows'); }
    if(!this.options.arrows){ return; }
    if(this.arrowLeft){ this.arrowLeft.addEventListener("click",()=>{ this.previous(); }); }
    if(this.arrowRight){ this.arrowRight.addEventListener("click",()=>{ this.next(); }); }
  }
  bindResize(){
    if(this.options.debugging){ console.log('@bindResize'); }
    window.addEventListener("resize",()=>{
      this.state.viewportWidth=this.viewport.clientWidth;
      this.state.dirty.workspace = true;
      this.render();
    });
  }
  // ==== Rest ====
  collectDesktopData(){
    if(this.options.debugging){ console.log('@collectDesktopData'); }
    this.desktops=[];
    [...this.workspace.children].forEach(page=>{
      this.desktops.push( this.createDesktop(page) );
    });
    /*
    this.names=[];
    this.pages = [...this.workspace.children];
    this.pages.forEach(page=>{
      this.names.push( page.dataset.name ?? "" );
    });
    this.count=this.pages.length; --> wird gegen this.desktops.length getauscht
    // ebenso this.names[index] --> this.desktops[index].name
    */
  }
  createDesktop(element){
    if(this.options.debugging){ console.log('@createDesktop'); }
    return {
      index:this.desktops.length,
      id:element.id,
      name:element.dataset.name ?? "",
      element:element,
      opened:false,
      prepared:false,
      rendered:false,
      visible:false,
      data:{},
      cache:{},
      dom:{},
      timer:{}
    };
  }
  desktop(index){ 
    if(this.options.debugging){ console.log('@desktop'); }
    return this.desktops[index]; }
  desktopById(id){ 
    if(this.options.debugging){ console.log('@desktopById'); }
    return this.desktops.find( desktop => desktop.id===id ); }
  desktopByName(name){ 
    if(this.options.debugging){ console.log('@desktopByName'); }
    return this.desktops.find( desktop => desktop.name===name ); }
  exists(index){ 
    if(this.options.debugging){ console.log('@exists'); }
    return index >= 0 && index < this.desktops.length; }
  setData(key, value){
    this.current().data[key] = value;
    return this;
  }
  getData(key){ 
    if(this.options.debugging){ console.log('@getData'); }
    return this.current().data[key]; }
  setCache(key, value){
    if(this.options.debugging){ console.log('@setCache'); }
    this.current().cache[key] = value;
    return this;
  }
  getCache(key){ 
    if(this.options.debugging){ console.log('@getCache'); }
    return this.current().cache[key]; }
}
