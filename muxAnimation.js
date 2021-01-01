/**
/*
 * @author yumyfeng
 * canvas帧序列动画
 
   var muxAnim = new MuxAnimation({
        element: '#canvas',
        frames: [],
        url: '',
        fps: 15, //每秒帧数，默认每秒15帧。（液晶屏每秒刷新60次，所以帧数最好是可以整除60的数）
        total: 0,
        loop: false,
        autoPlay: false,
        offline: false, //是否进行离屏渲染，提升雪碧图帧的渲染性能
        onRenderStart: function(){}, //序列帧开始渲染前的回调，只执行一次
        onFrameRenderBefore: function(index, spriteIndex){}, //每渲染一帧前的回调，此函数内部使用pause()无法阻止渲染当前帧
        onFrameRender: function(index, spriteIndex){}, //每渲染一帧后的回调
        onRenderEnd: function(){}, //渲染结束回调，loop情况下每一个循环执行一次
        onImgsLoad: function(){} //图片加载完成
   });

   muxAnim.start();
   muxAnim.play();
   muxAnim.pause();
   muxAnim.playToNextPause(cb1, cb2);

 */


;(function(){

    window.requestAnimationFrame = window.requestAnimationFrame ||
                                   window.webkitRequestAnimationFrame ||
                                   window.mozRequestAnimationFrame ||
                                   window.msRequestAnimationFrame ||
                                   window.oRequestAnimationFrame ||
                                   function (callback) {
                                     //为了使setTimteout的尽可能的接近每秒60帧的效果
                                     window.setTimeout(callback, 1000 / 60)
                                   };

    window.cancelAnimationFrame = window.cancelAnimationFrame ||
                                  Window.webkitCancelAnimationFrame ||
                                  window.mozCancelAnimationFrame ||
                                  window.msCancelAnimationFrame ||
                                  window.oCancelAnimationFrame ||
                                  function (id) {
                                    //为了使setTimteout的尽可能的接近每秒60帧的效果
                                    window.clearTimeout(id)
                                  };

    function MuxAnimation(opt){
        this.opt = {
            element: '',
            frames: [],
            url: '',
            fps: 15, //每秒帧数，默认每秒15帧。（液晶屏每秒刷新60次，所以帧数最好是可以整除60的数）
            total: 0,
            loop: false,
            autoPlay: false,
            offline: false, //是否进行离屏渲染，提升雪碧图帧的渲染性能
            onRenderStart: function(){}, //序列帧开始渲染前的回调，只执行一次
            onFrameRenderBefore: function(index, spriteIndex){}, //每渲染一帧前的回调
            onFrameRender: function(index, spriteIndex){}, //每渲染一帧后的回调
            onRenderEnd: function(){}, //渲染结束回调，loop情况下每一个循环执行一次
            onImgsLoad: function(){} //图片加载完成
        }
        for(var p in opt){
            if(this.opt.hasOwnProperty(p)) this.opt[p] = opt[p];
        }
        this.cvs = document.querySelector(this.opt.element);
        this.ctx = this.cvs.getContext('2d');
        this.offlineFrames = [];
        this.loaded = false;
        this.loadedImgs = [];
        this.playing = false;
        this.startIsOk = false; //防止重复执行
        this.nextRenderBeforeCallback = null;
        this.nextPauseCallback = null;
        this.raf = null;
        this.loading();
    }

    //开始离屏渲染
    MuxAnimation.prototype.offlineStart = function(){
        var curPos = 0; //数组当前帧
        var curSpritePos = 0; //单张雪碧图当前帧

        if(this.loaded){                
            while(curPos < this.opt.frames.length){
                if(this.opt.frames[curPos] instanceof Object){
                    //雪碧图片帧
                    while(curSpritePos < this.opt.frames[curPos].total){
                        this.drawOfflineSpriteFrame(this.loadedImgs[curPos], curPos, this.opt.frames[curPos].total, curSpritePos);
                        ++curSpritePos;
                    }
                    //结束单张雪碧图帧
                    curSpritePos = 0;
                }
                //普通图片帧
                else{ 
                    this.offlineFrames.push(this.loadedImgs[curPos]);
                }
                ++curPos;
            }
        }
    }

    //离屏渲染雪碧图帧
    MuxAnimation.prototype.drawOfflineSpriteFrame = function(img, curPos, total, curSpritePos){
        var offlineCvs = document.createElement('canvas');
        offlineCvs.width = this.cvs.width;
        offlineCvs.height = this.cvs.height;
        var offlineCtx = offlineCvs.getContext('2d');

        offlineCtx.clearRect(0, 0, offlineCvs.width, offlineCvs.height);

        if(this.opt.frames[curPos].direction == true){ //vertical
            var frameHeight = img.height / total;
            offlineCtx.drawImage(img, 0, frameHeight * curSpritePos, img.width, frameHeight, 0, 0, offlineCvs.width, offlineCvs.height);
        }else{ //horizontal
            var frameWidth = img.width / total;
            offlineCtx.drawImage(img, frameWidth * curSpritePos, 0, frameWidth, img.height, 0, 0, offlineCvs.width, offlineCvs.height);
        }

        this.offlineFrames.push(offlineCvs);
    }


    MuxAnimation.prototype.drawSpriteFrame = function(img, curPos, total, curSpritePos){
        this.ctx.clearRect(0, 0, this.cvs.width, this.cvs.height);
        if(this.opt.frames[curPos].direction == true){ //vertical
            var frameHeight = img.height / total;
            this.ctx.drawImage(img, 0, frameHeight * curSpritePos, img.width, frameHeight, 0, 0, this.cvs.width, this.cvs.height);
        }else{ //horizontal
            var frameWidth = img.width / total;
            this.ctx.drawImage(img, frameWidth * curSpritePos, 0, frameWidth, img.height, 0, 0, this.cvs.width, this.cvs.height);
        }
    }

    MuxAnimation.prototype.drawImgFrame = function(img){
        this.ctx.clearRect(0, 0, this.cvs.width, this.cvs.height);
        this.ctx.drawImage(img, 0, 0);
    }


    MuxAnimation.prototype.start = function(){
        if(this.startIsOk) return;
        this.startIsOk = true;
        var then = new Date().getTime();
        var stop = true;
        var frameTime = 1000 / this.opt.fps;
        var curPos = 0; //数组当前帧
        var curSpritePos = 0; //单张雪碧图当前帧
        var curOfflinePos = 0;
        this.playing = true;

        var self = this;

        (function(){
            this.raf = window.requestAnimationFrame(arguments.callee);
            if(!self.playing) return;
            var now = new Date().getTime();
            // console.log(now - then);
            if(now - then >= frameTime){
                then = now;
                stop = false;
            }else{
                stop = true;
            }
            if(stop) return;

            //只执行一次
            if(self.opt.onRenderStart){
                self.opt.onRenderStart();
                self.opt.onRenderStart = null;
            }

            if(self.loaded){
                if(curPos < self.opt.frames.length){
                    //雪碧图片帧
                    if(self.opt.frames[curPos] instanceof Object){
                        if(curSpritePos < self.opt.frames[curPos].total){
                            if(!self.playing) return;   //渲染前后可能pause，渲染前pause暂时无法阻止这一帧的渲染
                            self.opt.onFrameRenderBefore && self.opt.onFrameRenderBefore();
                            self.nextRenderBeforeCallback && self.nextRenderBeforeCallback();
                            if(self.opt.offline){
                                //离屏渲染
                                self.drawImgFrame(self.offlineFrames[curOfflinePos]);
                            }else{
                                //实时渲染
                                self.drawSpriteFrame(self.loadedImgs[curPos], curPos, self.opt.frames[curPos].total, curSpritePos);
                            }
                            // console.log(curSpritePos);
                            self.opt.onFrameRender(curPos, curSpritePos);
                            ++curSpritePos;
                            ++curOfflinePos;
                            return;
                        }
                        //结束单张雪碧图帧
                        curSpritePos = 0;
                        //校正离屏渲染下标
                        --curOfflinePos; 
                    }
                    //普通图片帧
                    else{ 
                        if(!self.playing) return;   //渲染前后可能pause，渲染前pause暂时无法阻止这一帧的渲染
                        self.opt.onFrameRenderBefore && self.opt.onFrameRenderBefore();
                        self.nextRenderBeforeCallback && self.nextRenderBeforeCallback();
                        self.drawImgFrame(self.loadedImgs[curPos]);
                        self.opt.onFrameRender(curPos, null);
                    }
                    ++curPos;
                    ++curOfflinePos;
                    return;
                }
                //结束全部数组帧
                if(self.opt.loop){
                    curPos = 0;
                    curSpritePos = 0;
                    curOfflinePos = 0;
                }
                else{
                    self.playing = false;
                    window.cancelAnimationFrame(self.raf);
                    self.raf = null;
                }
                self.opt.onRenderEnd();
            }
        })();
    }

    MuxAnimation.prototype.play = function(){
        this.playing = true;
    }

    MuxAnimation.prototype.playToNextPause = function(nextRenderBeforeCallback, nextPauseCallback){
        this.playing = true;
        this.nextRenderBeforeCallback = nextRenderBeforeCallback || null;
        this.nextPauseCallback = nextPauseCallback || null;
    }

    MuxAnimation.prototype.pause = function(){
        this.playing = false;
        this.nextPauseCallback && this.nextPauseCallback();
    }

    MuxAnimation.prototype.loading = function(){
        var self = this;
        var count = 0;

        for(var i = 0, len = this.opt.frames.length; i < len; i++){
            var img = new Image();
            if(this.opt.frames[i] instanceof Object) img.src = this.opt.url + this.opt.frames[i].img;
            else img.src = this.opt.url + this.opt.frames[i];
            img.onload = (function(img, index){
                return function(){
                    ++count;
                    self.loadedImgs[index] = img;
                }
            })(img, i);
        }

        var timer = setInterval(function(){
            if(count == self.opt.frames.length){
                clearInterval(timer);
                self.loaded = true;
                //是否离屏渲染
                self.opt.offline && self.offlineStart();
                //加载完成放在离屏渲染之后
                self.opt.onImgsLoad();
                //开始执行动画
                self.opt.autoPlay && self.start();
            }
        }, 50);
    }

    typeof module == 'object' ? module.MuxAnimation = MuxAnimation : window.MuxAnimation = MuxAnimation;

})();