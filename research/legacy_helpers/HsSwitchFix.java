// Headless pre-script: resolve an MSVC jump table Ghidra could not recover.
// args: <jmpRvaHex> <tableRvaHex> <count> [<jmpRvaHex> <tableRvaHex> <count> ...]
// Each table entry is a uint32 offset from the image base. Adds COMPUTED_JUMP references
// from the indirect jump to every target (the decompiler uses them as switch destinations),
// disassembles the targets and re-computes the owning function's body.
import ghidra.app.script.GhidraScript;
import ghidra.app.cmd.function.CreateFunctionCmd;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.pcode.JumpTable;
import ghidra.program.model.symbol.*;
import java.util.*;

public class HsSwitchFix extends GhidraScript {
    public void run() throws Exception {
        String[] args = getScriptArgs();
        Address base = currentProgram.getImageBase();
        for (int i = 0; i + 2 < args.length; i += 3) {
            long jmpRva = Long.parseUnsignedLong(args[i].replace("0x", ""), 16);
            long tabRva = Long.parseUnsignedLong(args[i + 1].replace("0x", ""), 16);
            int count = Integer.parseInt(args[i + 2]);
            Address jmp = base.add(jmpRva);
            Address tab = base.add(tabRva);
            Function f = getFunctionContaining(jmp);
            Instruction ins = getInstructionAt(jmp);
            if (ins == null) { disassemble(jmp); ins = getInstructionAt(jmp); }
            if (ins == null) { println("no instruction at " + jmp); continue; }
            int n = 0;
            for (int k = 0; k < count; k++) {
                long off = ((long) getInt(tab.add(4L * k))) & 0xffffffffL;
                Address t = base.add(off);
                if (getInstructionAt(t) == null) disassemble(t);
                ins.addOperandReference(0, t, RefType.COMPUTED_JUMP, SourceType.USER_DEFINED);
                n++;
            }
            ins.setFlowOverride(FlowOverride.NONE);
            if (f == null) {
                // create the owning function first so the override has somewhere to live
                Address entry = base.add(Long.parseUnsignedLong(System.getProperty("hs.entry", "803010"), 16));
                disassemble(entry);
                f = createFunction(entry, "DoCraftResult");
            }
            if (f != null) {
                ArrayList<Address> destlist = new ArrayList<Address>();
                for (int k = 0; k < count; k++) {
                    long off = ((long) getInt(tab.add(4L * k))) & 0xffffffffL;
                    destlist.add(base.add(off));
                }
                JumpTable jt = new JumpTable(jmp, destlist, true, 0);
                jt.writeOverride(f);
                AddressSetView body = CreateFunctionCmd.getFunctionBody(currentProgram, f.getEntryPoint());
                f.setBody(body);
                println("switch override at " + jmp + " -> " + n + " targets; function " + f.getName() + " body now " + body.getNumAddresses() + " bytes");
            } else {
                println("switch refs at " + jmp + " -> " + n + " targets (no function)");
            }
        }
    }
}
