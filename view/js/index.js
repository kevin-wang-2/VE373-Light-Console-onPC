const EventEmitter = require("events");
const Dialog = require('./dialog')

const globalEvent = new EventEmitter();

function grayscale(portion) {
    const one = (portion * 0xff).toString(16);
    return "#" + one + one + one;
}

function toHexColor(r, g, b) {
    let color = "#";
    if (r < 16) color += "0";
    color += r.toString(16);
    if (g < 16) color += "0";
    color += g.toString(16);
    if (b < 16) color += "0";
    color += b.toString(16);
    return color;
}

function between(x, x0, x1) {
    if (x0 > x1) {
        let xt = x0;
        x0 = x1;
        x1 = xt;
    }
    return (x0 <= x && x <= x1);
}

class Fader {
    constructor(id, func, value) {
        this.id = id;
        this.func = func;
        this.value = value;
    }

    render() {
        // 1. Generate Objects

        this.obj = $("<div class=\"fader\"></div>");
        this.name_tag = $("<div class=\"fader-name\">\n" +
            "                Fader " + (this.id + 1).toString() + "\n" +
            "            </div>");
        this.func_tag = $("<div class=\"fader-function\">\n" +
            "                " + this.func.toString() + "\n" +
            "            </div>");
        this.footer = $("<div class=\"fader-footer\"></div>");
        this.value_tag = $(" <div class=\"fader-value\">\n" +
            "                    " + this.value.toString() + "\n" +
            "                </div>");
        this.go_tag = $(" <div class=\"fader-go\">\n" +
            "                    GO\n" +
            "                </div>");
        this.footer.append(this.value_tag);
        this.footer.append(this.go_tag);
        this.obj.append(this.name_tag);
        this.obj.append(this.func_tag);
        this.obj.append(this.footer);

        // 2. Bind actions
        this.go_tag.click(() => {
            if (this.value)
                this.value.toFull();
        });

        this.value.on("change", () => {
            this.value_tag.html(this.value.toString());
            this.value_tag.css({
                "background-color": grayscale(this.value.value / this.value.full),
                "color": ((this.value.value < this.value.full / 2) ? "white" : "black")
            });
        });

        this.value_tag.on("click", () => {
            if (this.value)
                (new Dialog({
                    name: "Set value for " + this.func,
                    default: this.value.value,
                    controls: {
                        keypad: {},
                        control: {},
                        utility: {
                            min: 0,
                            max: this.value.full
                        }
                    },
                    bind: {
                        value: this.value
                    }
                })).show();
        })

        return this.obj;
    }

    changeFunc(func, value) {
        if (this.value) {
            this.value.off("change", () => {
                this.value_tag.html(this.value.toString());
                this.value_tag.css({
                    "background-color": grayscale(this.value.value / this.value.full),
                    "color": ((this.value.value < this.value.full / 2) ? "white" : "black")
                });
            });
        }
        this.func = func;
        this.func_tag.html(this.func);
        this.value = value;
        if (value) {
            this.value_tag.html(this.value.value);
            this.value_tag.css({
                "background-color": grayscale(this.value.value / this.value.full),
                "color": ((this.value.value < this.value.full / 2) ? "white" : "black")
            });
            this.value.on("change", () => {
                this.value_tag.html(this.value.toString());
                this.value_tag.css({
                    "background-color": grayscale(this.value.value / this.value.full),
                    "color": ((this.value.value < this.value.full / 2) ? "white" : "black")
                });
            });
        } else {
            this.value_tag.html("");
            this.value_tag.css({
                    "background-color": "black",
                    "color": "white"
                });
        }
    }
}

class Value extends EventEmitter {
    constructor(type, value) {
        super();
        this.type = type;
        this.value = value;
        if (type === "DMX" || type === "PARAM") {
            this.unit = "";
            this.full = 255;
        } else {
            this.unit = "%";
            this.full = 100
        }
    }

    set(value) {
        this.value = value;
        this.emit("change");
    }

    toFull() {
        this.value = this.full;
        this.emit("change");
    }

    toString() {
        return this.value.toString() + this.unit;
    }
}

class ParameterButton {
    constructor(param, arg) {
        this.parameter = param;
        this.button = $("<button class=\"parameter-button\">\n"
            + arg + ": 0\n" +
                "</button>");
        this.value = new Value("PARAM", 0);

        this.value.on("change", () => {
            this.button.html(arg + ": " + this.value.value.toString());
        });

        this.breakPipe = false;

        this.value.on("change", () => {
            if (this.breakPipe) return;
            for(const fixture of fixtures) {
                if (fixture.selected && fixture.parameters[param] && fixture.parameters[param][arg]) {
                    fixture.parameters[param][arg].set(this.value.value);
                }
            }
        });

        globalEvent.on("selectionChange", () => {
            this.breakPipe = true;
            this.value.set(0);
            this.breakPipe = false;
        });
    }
}

const DMXValues = (
    function () {
        const values = [];
        for (let channel = 0; channel < 512; channel++) {
            values.push(new Value("DMX", 0));
        }
        return values;
    }
)();

let currentFunction = "Channel";
let curPage = 0;
let faders = [];

function faderPageChange() {
    switch (currentFunction) {
        case "Channel":
            for (let i = 0; i < 8; i++) {
                faders[i].changeFunc("DMX Channel " + (i + curPage * 8).toString(), DMXValues[i + curPage * 8]);
            }
            break;
        case "Function":
            const key = Object.keys(parameters)[curPage];
            let i = 0;
            for(const arg in parameters[key].args) {
                faders[i++].changeFunc(arg, parameters[key].args[arg].value);
            }
            for (; i < 8; i++) {
                faders[i].changeFunc("&nbsp;", null);
            }
            break;
    }
}

let highLtOn = false;

class Fixture extends EventEmitter {
    constructor(model, address, x = 0, y = 0) {
        super();
        this.model = model;
        this.address = address;
        this.parameters = {};

        for (const parameter in model.parameters) {
            for (const arg in model.parameters[parameter]) {
                const modelData = model.parameters[parameter][arg];
                DMXValues[modelData.channel + this.address].set(modelData.default);
                DMXValues[modelData.channel + this.address].on("change", () => {
                    this.emit("change");
                });
                if (!this.parameters.hasOwnProperty(parameter)) this.parameters[parameter] = {};
                this.parameters[parameter][arg] = {
                    value: DMXValues[modelData.channel + this.address],
                    originalValue: 0,
                    high: false,
                    set(value) {
                        this.value.set(value);
                    },
                    highLt() {
                        this.originalValue = this.value.value;
                        this.high = true;
                        this.value.set(modelData.highLt);
                    },
                    deHighLt() {
                        if (this.high)
                            this.value.set(this.originalValue);
                    }
                }
            }
        }

        this.selected = false;
        this.pos = [x, y];
    }

    highLt() {
        for (const parameter in this.parameters) {
            for (const arg in this.parameters[parameter]) {
                this.parameters[parameter][arg].highLt();
            }
        }
    }

    deHighLt() {
        for (const parameter in this.parameters) {
            for (const arg in this.parameters[parameter]) {
                this.parameters[parameter][arg].deHighLt();
            }
        }
    }
}

let fixtures = [];

const parameters = {
    DIMMER: {
        button: null,
        args: {
            DIM: null
        }
    },
    COLOR: {
        button: null,
        args: {
            R: null,
            G: null,
            B: null,
            W: null
        }
    },
    BEAM: {
        button: null,
        args: {
            Strobe: null,
            Shutter: null
        }
    }
}

let activeParameter = "DIMMER";
let activeParameterId = 0;

const layout = {
    fixtureWidth: 20,
    fixtureHeight: 30,
    setup: false,
    event: {
        startX: 0,
        startY: 0,
        start: false
    },
    fixtures: [],
    init() {
        this.canvas = $("canvas");
        this.canvas[0].height = window.innerHeight * 0.57;
        this.canvas[0].width = window.innerWidth * 0.95;
        this.layoutCtx = this.canvas[0].getContext("2d");
        this.canvas.on("mousedown", (e) => {
            this.onmousedown(e);
        });
        this.canvas.on("mousemove", (e) => {
            this.onmousemove(e);
        });
        this.canvas.on("mouseup", (e) => {
            this.onmouseup(e);
        });
        this.canvas.on("mouseout", (e) => {
            this.onmouseup(e);
        });
        $("#clear").on("click", () => {
            this.layoutCtx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);
            for (const fixture of this.fixtures) {
                fixture.selected = false;
                if (highLtOn) fixture.deHighLt();
                else this.redrawFixture(fixture);
            }
            globalEvent.emit("selectionChange");
        });
    },
    drawFixture: function (fixture) {
        this.fixtures.push(fixture);
        fixture.on("change", () => {
            this.redraw();
        });
        this.redrawFixture(fixture);
    },
    redraw() {
        this.layoutCtx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);
        for (const fixture of this.fixtures) {
            this.redrawFixture(fixture);
        }
    },
    redrawFixture: function (fixture) {
        const x = fixture.pos[0];
        const y = fixture.pos[1];
        if (fixture.selected) {
            this.layoutCtx.strokeStyle = "#FFFF00";
        } else {
            this.layoutCtx.strokeStyle = "#FFFFFF";
        }
        let portion;
        if (fixture.parameters.DIMMER && fixture.parameters.DIMMER.DIM) {
            portion = fixture.parameters.DIMMER.DIM.value.value / 255;
        }
        let red = 0, green = 0, blue = 0;
        if (fixture.parameters.COLOR) {
            if (fixture.parameters.COLOR.R) {
                red += fixture.parameters.COLOR.R.value.value;
            }
            if (fixture.parameters.COLOR.G) {
                green += fixture.parameters.COLOR.G.value.value;
            }
            if (fixture.parameters.COLOR.B) {
                blue += fixture.parameters.COLOR.B.value.value;
            }
            if (fixture.parameters.COLOR.W) {
                red += fixture.parameters.COLOR.W.value.value;
                if (red > 255) red = 255;
                green += fixture.parameters.COLOR.W.value.value;
                if (green > 255) green = 255;
                blue += fixture.parameters.COLOR.W.value.value;
                if (blue > 255) blue = 255;
            }
        }
        this.layoutCtx.fillStyle = toHexColor(Math.floor(portion * red).toString(16),
            Math.floor(portion * green).toString(16),
            Math.floor(portion * blue).toString(16));
        console.log(toHexColor(Math.floor(portion * red).toString(16),
            Math.floor(portion * green).toString(16),
            Math.floor(portion * blue).toString(16)))
        this.layoutCtx.beginPath();
        this.layoutCtx.moveTo(x, y);
        this.layoutCtx.lineTo(x + this.fixtureWidth, y);
        this.layoutCtx.lineTo(x + this.fixtureWidth, y + this.fixtureHeight);
        this.layoutCtx.lineTo(x, y + this.fixtureHeight);
        this.layoutCtx.lineTo(x, y);
        this.layoutCtx.fill();
        this.layoutCtx.stroke();
    },
    onmousedown(e) {
        this.event.startX = e.offsetX;
        this.event.startY = e.offsetY;
        this.event.start = true;
    },
    onmousemove(e) {
        if (this.event.start) {
            this.layoutCtx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);
            for (const fixture of this.fixtures) {
                this.redrawFixture(fixture);
            }
            this.layoutCtx.strokeStyle = "#0000ff";
            this.layoutCtx.beginPath();
            this.layoutCtx.moveTo(this.event.startX, this.event.startY);
            this.layoutCtx.lineTo(e.offsetX, this.event.startY);
            this.layoutCtx.lineTo(e.offsetX, e.offsetY);
            this.layoutCtx.lineTo(this.event.startX, e.offsetY);
            this.layoutCtx.lineTo(this.event.startX, this.event.startY);
            this.layoutCtx.stroke();
        }

    },
    onmouseup(e) {
        if (this.event.start) {
            this.event.start = false;
            this.layoutCtx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);
            for (const fixture of this.fixtures) {
                const x = fixture.pos[0];
                const y = fixture.pos[1];
                if (between(x, this.event.startX, e.offsetX) && between(y, this.event.startY, e.offsetY)) {
                    fixture.selected = true;
                    if (highLtOn) fixture.highLt();
                }
                this.redrawFixture(fixture);
            }
        }
        globalEvent.emit("selectionChange");
    }
}

$(document).ready(() => {
    for (let i = 0; i < 8; i++) {
        const fader = new Fader(i, "DMX Channel " + i.toString(), DMXValues[i]);
        faders.push(fader);
        $(".faders").append(fader.render());
    }

    $("#channel").on("click", () => {
        currentFunction = "Channel";
        curPage = 0;
        faderPageChange();
    })

    $("#function").on("click", () => {
        currentFunction = "Function";
        curPage = activeParameterId;
        faderPageChange();
    })

    $("#pageUp").on("click", () => {
        switch (currentFunction) {
            case "Channel":
                if (curPage < 63) {
                    curPage++;
                }
                break;
            case "Function":
                if (curPage < Object.keys(parameters).length) {
                    curPage++;
                }
                break;

        }
        faderPageChange();
    });

    $("#pageDown").on("click", () => {
        switch (currentFunction) {
            case "Channel":
            case "Function":
                if (curPage > 0) {
                    curPage--;
                }
                break;
        }
        faderPageChange();
    });

    $("#pageSkip").on("click", () => {
        (new Dialog({
                name: "Set value for " + this.func,
                default: curPage + 1,
                controls: {
                    keypad: {},
                    control: {},
                    utility: {
                        min: 1,
                        max: 64
                    }
                },
                bind: {
                    function: (value) => {
                        curPage = value - 1;
                        faderPageChange();
                    }
                }
            })).show();
    });

    const highLtBtn = $("#highLt");

    highLtBtn.on("click", () => {
        highLtOn = !highLtOn;
        if (highLtOn) {
            highLtBtn.css({color: "yellow"});
            for (let fixture of fixtures) {
                if (fixture.selected) {
                    fixture.highLt();
                }
            }
        } else {
            highLtBtn.css({color: "white"});
            for (let fixture of fixtures) {
                fixture.deHighLt();
            }
        }
    })

    let paramCounter = 0;
    for (const parameter in parameters) {
        const button = $("\n" +
            "            <button class=\"parameter-button\">\n" +
            "                " + parameter + "\n" +
            "            </button>");
        $(".parameter-header").append(button);
        parameters[parameter].button = button;
        for (const arg in parameters[parameter].args) {
            parameters[parameter].args[arg] = new ParameterButton(parameter, arg);
        }
        let paramId = paramCounter;
        button.click(() => {
            parameters[activeParameter].button.css({color: "white"});
            activeParameter = parameter;
            activeParameterId = paramId;
            parameters[activeParameter].button.css({color: "yellow"});
            const body = $(".parameter-body");
            body.html("");
            for (const arg in parameters[parameter].args) {
                body.append(parameters[parameter].args[arg].button);
            }
            if (currentFunction === "Function") {
                curPage = paramId;
                faderPageChange();
            }
        });
        paramCounter++;
    }
    const body = $(".parameter-body");
    for (const arg in parameters[activeParameter].args) {
        body.append(parameters[activeParameter].args[arg].button);
    }
    parameters[activeParameter].button.css({color: "yellow"});

    layout.init();
    for (let i = 0; i < 10; i++) {
        fixtures.push(new Fixture({
                parameters: {
                    DIMMER: {
                        DIM: {
                            channel: 0,
                            default: 0,
                            highLt: 255
                        }
                    },
                    BEAM: {
                        Shutter: {
                            channel: 1,
                            default: 0,
                            highLt: 0
                        }
                    },
                    COLOR: {
                        R: {
                            channel: 2,
                            default: 0,
                            highLt: 0
                        },
                        G: {
                            channel: 3,
                            default: 0,
                            highLt: 0
                        },
                        B: {
                            channel: 4,
                            default: 0,
                            highLt: 0
                        },
                        W: {
                            channel: 5,
                            default: 0,
                            highLt: 255
                        },
                    }
                }
            }, i * 8, 50 + i * layout.fixtureWidth, 50)
        );
        layout.drawFixture(fixtures[i]);
    }
})
