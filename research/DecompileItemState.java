// Decompile one or more explicit code ranges in one headless pass.
// Arguments are repeated quadruples:
// <start-address> <end-address-exclusive> <function-name> <output-path>.
// @category HeroSiege

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.SourceType;

import java.io.File;
import java.io.PrintWriter;

public class DecompileItemState extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length == 0 || args.length % 4 != 0) {
            throw new IllegalArgumentException(
                "Expected repeated quadruples: start end-exclusive name output"
            );
        }

        DecompInterface decompiler = new DecompInterface();
        ghidra.app.decompiler.DecompileOptions options = new ghidra.app.decompiler.DecompileOptions();
        options.setMaxPayloadMBytes(100);
        options.setMaxJumpTableEntries(4096);
        options.setMaxInstructions(1000000);
        decompiler.setOptions(options);
        decompiler.openProgram(currentProgram);
        try {
            for (int index = 0; index < args.length; index += 4) {
                Address start = toAddr(args[index]);
                Address end = toAddr(args[index + 1]).subtract(1);
                String name = args[index + 2];
                File output = new File(args[index + 3]);
                AddressSet body = new AddressSet(start, end);

                java.util.Iterator<Function> overlapping =
                    currentProgram.getFunctionManager().getFunctionsOverlapping(body);
                while (overlapping.hasNext()) {
                    currentProgram.getFunctionManager().removeFunction(
                        overlapping.next().getEntryPoint()
                    );
                }
                byte[] originalCase = null;
                if (name.startsWith("CraftCase")) {
                    originalCase = java.nio.file.Files.readAllBytes(java.nio.file.Path.of("research/current/"+name+".bin"));
                    clearListing(start,end.add(16));
                    currentProgram.getMemory().setBytes(start,originalCase);
                }
                disassemble(start);
                // The Windows stack probe preserves RAX. An unknown-call
                // prototype makes Ghidra treat the entire frame as dynamic.
                // Omit this prologue call only in the analysis database and
                // restore it immediately after decompilation.
                Address probeAddress = null;
                byte[] probeBytes = null;
                if (name.endsWith("Decoded")) {
                    for (ghidra.program.model.listing.Instruction ins : currentProgram.getListing().getInstructions(new AddressSet(start,start.add(80)),true)) {
                        if (!ins.getFlowType().isCall()) continue;
                        for (Address destination : ins.getFlows()) {
                            if (destination.equals(toAddr("14b8ffc80"))) {
                                probeAddress=ins.getAddress();probeBytes=ins.getBytes();break;
                            }
                        }
                    }
                    if (probeAddress != null) {
                        clearListing(probeAddress,probeAddress.add(probeBytes.length-1));
                        byte[] nops=new byte[probeBytes.length];java.util.Arrays.fill(nops,(byte)0x90);
                        currentProgram.getMemory().setBytes(probeAddress,nops);disassemble(probeAddress);
                    }
                }
                // Artificial craft-case entries share the outer function's huge
                // cleanup graph. Clip exits in the Ghidra database only, never
                // in the source PE, so each case can be inspected independently.
                if (name.startsWith("CraftCase")) {
                    Address boundary = end.add(1);
                    clearListing(boundary, boundary.add(15));
                    setByte(boundary, (byte)0xc3);
                    disassemble(boundary);
                    body.add(boundary);
                    java.util.ArrayList<Address> exits = new java.util.ArrayList<>();
                    for (ghidra.program.model.listing.Instruction ins : currentProgram.getListing().getInstructions(body, true)) {
                        if (!ins.getFlowType().isJump() || ins.getFlowType().isConditional()) continue;
                        for (Address destination : ins.getFlows()) {
                            if (!body.contains(destination)) { exits.add(ins.getAddress()); break; }
                        }
                    }
                    for (Address exit : exits) {
                        clearListing(exit, currentProgram.getListing().getInstructionAt(exit).getMaxAddress());
                        setByte(exit, (byte)0xc3);
                        disassemble(exit);
                    }
                    println("Clipped " + exits.size() + " shared exits for " + name);
                }
                overlapping = currentProgram.getFunctionManager().getFunctionsOverlapping(body);
                while (overlapping.hasNext()) currentProgram.getFunctionManager().removeFunction(overlapping.next().getEntryPoint());
                Function function = currentProgram.getFunctionManager().createFunction(
                    name, start, body, SourceType.USER_DEFINED
                );
                if (function == null) {
                    throw new IllegalStateException("Could not create function at " + start);
                }
                DecompileResults result = decompiler.decompileFunction(function, name.contains("NormalWeapon") ? 180 : name.endsWith("Decoded") ? 45 : 600, monitor);
                if (probeAddress != null) {
                    clearListing(probeAddress,probeAddress.add(probeBytes.length-1));
                    currentProgram.getMemory().setBytes(probeAddress,probeBytes);disassemble(probeAddress);
                }
                if (!result.decompileCompleted()) {
                    throw new IllegalStateException(
                        "Decompile failed for " + name + ": " + result.getErrorMessage()
                    );
                }
                try (PrintWriter writer = new PrintWriter(output, "UTF-8")) {
                    writer.println("Program: " + currentProgram.getName());
                    writer.println(
                        "Artificial function: " + name + " @ " + start + ".." + end
                    );
                    writer.println(result.getDecompiledFunction().getC());
                }
                println("Decompiled " + name + " -> " + output);
                if (originalCase != null) {
                    Address boundary=end.add(1);
                    clearListing(boundary,boundary.add(15));
                    currentProgram.getMemory().setBytes(boundary,java.util.Arrays.copyOfRange(originalCase,originalCase.length-16,originalCase.length));
                }
            }
        }
        finally {
            decompiler.dispose();
        }
    }
}
