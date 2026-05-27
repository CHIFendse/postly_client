// setstack — патчит PE-заголовок EXE, выставляя нужный размер стека.
// Использование: setstack <file.exe> <reserve_bytes> [commit_bytes]
// Пример:        setstack postly.exe 134217728 4194304  (128 МБ reserve, 4 МБ commit)
package main

import (
	"encoding/binary"
	"fmt"
	"os"
	"strconv"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintf(os.Stderr, "usage: setstack <file.exe> <reserve> [commit]\n")
		os.Exit(1)
	}
	path := os.Args[1]
	reserve, err := strconv.ParseUint(os.Args[2], 10, 64)
	if err != nil {
		fmt.Fprintf(os.Stderr, "bad reserve: %v\n", err)
		os.Exit(1)
	}
	commit := uint64(0)
	if len(os.Args) >= 4 {
		commit, err = strconv.ParseUint(os.Args[3], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "bad commit: %v\n", err)
			os.Exit(1)
		}
	}

	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	// DOS header: e_lfanew at offset 0x3c
	var eLfanew uint32
	f.Seek(0x3c, 0)
	binary.Read(f, binary.LittleEndian, &eLfanew)

	// PE signature (4) + COFF header (20) = 24 bytes → Optional header starts
	optHdrOff := int64(eLfanew) + 4 + 20

	// Magic at start of optional header: 0x10b = PE32, 0x20b = PE32+
	f.Seek(optHdrOff, 0)
	var magic uint16
	binary.Read(f, binary.LittleEndian, &magic)

	var stackReserveOff, stackCommitOff int64
	switch magic {
	case 0x10b: // PE32
		stackReserveOff = optHdrOff + 72
		stackCommitOff = optHdrOff + 76
		var r32, c32 uint32
		f.Seek(stackReserveOff, 0)
		binary.Read(f, binary.LittleEndian, &r32)
		f.Seek(stackCommitOff, 0)
		binary.Read(f, binary.LittleEndian, &c32)
		fmt.Printf("PE32  current: reserve=0x%x commit=0x%x\n", r32, c32)
	case 0x20b: // PE32+
		stackReserveOff = optHdrOff + 88
		stackCommitOff = optHdrOff + 96
		var r64, c64 uint64
		f.Seek(stackReserveOff, 0)
		binary.Read(f, binary.LittleEndian, &r64)
		f.Seek(stackCommitOff, 0)
		binary.Read(f, binary.LittleEndian, &c64)
		fmt.Printf("PE32+ current: reserve=0x%x commit=0x%x\n", r64, c64)
	default:
		fmt.Fprintf(os.Stderr, "unknown magic: 0x%x\n", magic)
		os.Exit(1)
	}

	// Write new values
	if magic == 0x10b {
		f.Seek(stackReserveOff, 0)
		binary.Write(f, binary.LittleEndian, uint32(reserve))
		if commit > 0 {
			f.Seek(stackCommitOff, 0)
			binary.Write(f, binary.LittleEndian, uint32(commit))
		}
	} else {
		f.Seek(stackReserveOff, 0)
		binary.Write(f, binary.LittleEndian, reserve)
		if commit > 0 {
			f.Seek(stackCommitOff, 0)
			binary.Write(f, binary.LittleEndian, commit)
		}
	}

	fmt.Printf("OK: reserve=0x%x (%d MB)", reserve, reserve/1024/1024)
	if commit > 0 {
		fmt.Printf("  commit=0x%x (%d MB)", commit, commit/1024/1024)
	}
	fmt.Println()
}
