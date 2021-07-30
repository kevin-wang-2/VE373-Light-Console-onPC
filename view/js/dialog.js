module.exports = class Dialog {
    constructor(dsl) {
        this.base = $("<div class=\"dialog\">\n" +
            "    <div class=\"dialog-row\">\n" +
            "        <div class=\"dialog-inner\">\n" +
            "            <div class=\"dialog-header\">\n" +
            "                " + dsl.name + "\n" +
            "            </div>\n" +
            "            <div class=\"dialog-body\">\n" +
            "                <div class=\"dialog-row\">\n" +
            "                    <input class=\"dialog-input\" />\n" +
            "                </div>\n" +
            "                <div class=\"dialog-row\" tag='content'>\n" +
            "                </div>\n" +
            "            </div>\n" +
            "        </div>\n" +
            "    </div>\n" +
            "</div>");

        if (dsl.controls.hasOwnProperty("keypad")) this.generateKeyPad();
        if (dsl.controls.hasOwnProperty("control")) this.generateControlPad();
        if (dsl.controls.hasOwnProperty("utility")) {
            this.generateUtilityPad();
            this.min_value = dsl.controls.utility.min;
            this.max_value = dsl.controls.utility.max;
            if (!this.min_value) this.min_value = 0;
            if (!this.max_value) this.max_value = 255;
        }

        if (dsl.bind) {
            this.bind = dsl.bind;
        }

        this.base.find("button").on("click", () => {
            this.input[0].focus();
        })

        this.base.find(".dialog-inner").on("click", (evt) => {
            evt.stopPropagation();
        });
        this.base.on("click", () => {
            this.base.remove();
        });

        this.input = this.base.find("input");

        this.input.on("keydown", (e) => {
            if (e.keyCode === 13) this.submit();
            if (e.keyCode === 27) this.base.remove();
        })

        if (dsl.hasOwnProperty("default")) this.input.val(dsl.default);
    }

    generateKeyPad() {
        let base = $("<div class=\"dialog-control-item\">\n" +
            "   <table class=\"dialog-table\">\n" +
            "   </table>\n" +
            "</div>\n");
        const table = base.find("table");

        for (let row = 0; row < 3; row++) {
            const tr = $("<tr class=\"dialog-tr\"></tr>")
            for (let column = 1; column < 4; column++) {
                let element = $("<td><button class='dialog-key'>" + (column + row * 3).toString() + "</button></td>")
                tr.append(element);
                element.find("button").on("click", () => {
                    this.enter((column + row * 3).toString())
                })
            }
            table.append(tr);
        }

        const tr = $("<tr class=\"dialog-tr\"></tr>");
        const zero = $("<td><button class='dialog-key'>0</button></td>")
        zero.find("button").on("click", () => {
            this.enter("0");
        });
        const dot = $("<td><button class='dialog-key'>.</button></td>")
        dot.find("button").on("click", () => {
            this.enter(".");
        });
        tr.append(zero);
        tr.append(dot);
        tr.append("<td></td>");
        table.append(tr);
        this.base.find("[tag='content']").append(base);
    }

    generateControlPad() {
        let base = $("<div class=\"dialog-control-item\">\n" +
            "   <table class=\"dialog-table\">\n" +
            "   </table>\n" +
            "</div>\n");
        const table = base.find("table");
        const trBack = $("<tr class=\"dialog-tr\"></tr>");
        const clear = $("<td><button class='dialog-key'>Clear</button></td>");
        const del = $("<td><button class='dialog-key'>Delete</button></td>");
        clear.find("button").on("click", () => { this.clear(); });
        del.find("button").on("click", () => { this.delete(); });
        trBack.append(clear);
        trBack.append(del);
        table.append(trBack);
        const trHome = $("<tr class=\"dialog-tr\"></tr>");
        const home = $("<td><button class='dialog-key'>Home</button></td>");
        const end = $("<td><button class='dialog-key'>End</button></td>");
        home.find("button").on("click", () => { this.toHome(); });
        end.find("button").on("click", () => { this.toEnd(); });
        trHome.append(home);
        trHome.append(end);
        table.append(trHome);
        const trPrev = $("<tr class=\"dialog-tr\"></tr>");
        const prev = $("<td><button class='dialog-key'>&lt;--</button></td>");
        const next = $("<td><button class='dialog-key'>--&gt;</button></td>");
        prev.find("button").on("click", () => { this.prev(); });
        next.find("button").on("click", () => { this.next(); });
        trPrev.append(prev);
        trPrev.append(next);
        table.append(trPrev);
        const trPlease = $("<tr class=\"dialog-tr\"><td colspan='2'><button class='dialog-key'>Please</button></td></tr>");
        trPlease.find("button").on("click", () => { this.submit(); });
        table.append(trPlease);
        this.base.find("[tag='content']").append(base);
    }

    generateUtilityPad() {
        let base = $("<div class=\"dialog-control-item\">\n" +
            "   <table class=\"dialog-table\">\n" +
            "   </table>\n" +
            "</div>\n");
        const table = base.find("table");
        const trMin = $("<tr class=\"dialog-tr\"></tr>");
        const min = $("<td><button class='dialog-key'>Min</button></td>");
        const max = $("<td><button class='dialog-key'>Max</button></td>");
        min.find("button").on("click", () => { this.min(); });
        max.find("button").on("click", () => { this.max(); });
        trMin.append(min);
        trMin.append(max);
        table.append(trMin);
        this.base.find("[tag='content']").append(base);
    }

    enter(char) {
        let originalValue = this.input.val();
        let originCursor = this.input[0].selectionStart;
        this.input.val(originalValue.slice(0, this.input[0].selectionStart) + char + originalValue.slice(this.input[0].selectionStart));
        this.input[0].selectionStart = originCursor + 1;
        this.input[0].selectionEnd = originCursor + 1;
    }

    clear() {
        this.input.val("");
    }

    delete() {

    }

    toHome() {

    }

    toEnd() {

    }

    prev() {
        const obj = this.input[0];
        if (obj.selectionStart !== 0) {
            obj.selectionStart--;
            obj.selectionEnd = obj.selectionStart;
        }
    }

    next() {
        const obj = this.input[0];
        if (obj.selectionStart !== this.input.val().length) {
            obj.selectionStart++;
            obj.selectionEnd = obj.selectionStart;
        }

    }

    submit() {
        if (this.bind && this.bind.value) this.bind.value.set(Math.max(Math.min(parseInt(this.input.val()) | 0, this.max_value), this.min_value));
        if (this.bind && this.bind.function) this.bind.function(Math.max(Math.min(parseInt(this.input.val()) | 0, this.max_value), this.min_value));
        this.base.remove();
    }

    min() {
        this.input.val(this.min_value.toString());
    }

    max() {
        this.input.val(this.max_value.toString());
    }

    show() {
        $(document.body).append(this.base);
        this.input[0].focus();
    }
}
