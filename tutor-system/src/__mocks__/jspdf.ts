export default class jsPDF {
    constructor() {}
    text = jest.fn();
    save = jest.fn();
    setFontSize = jest.fn();
    setFont = jest.fn();
    addPage = jest.fn();
    internal = {
        pageSize: {
            getHeight: jest.fn(() => 297)
        }
    };
}