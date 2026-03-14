import tkinter as tk
from tkinter import messagebox

PIECES = {
    'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
    'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
}

LIGHT = '#F0D9B5'
DARK  = '#B58863'
SEL   = '#F6F669'
HINT  = '#CDD16F'
LAST  = '#CDD16F'

def init_board():
    return [
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP','bP','bP','bP','bP'],
        [None]*8, [None]*8, [None]*8, [None]*8,
        ['wP','wP','wP','wP','wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
    ]

def col(p):  return p[0] if p else None
def typ(p):  return p[1] if p else None
def opp(c):  return 'b' if c == 'w' else 'w'

def in_bounds(r, c): return 0 <= r < 8 and 0 <= c < 8

def raw_moves(b, r, c, ep):
    p = b[r][c]
    if not p: return []
    pc, pt = col(p), typ(p)
    moves = []

    def add(nr, nc):
        if in_bounds(nr, nc): moves.append((nr, nc))

    def slide(dr, dc):
        nr, nc = r+dr, c+dc
        while in_bounds(nr, nc):
            if b[nr][nc]:
                if col(b[nr][nc]) != pc: moves.append((nr, nc))
                break
            moves.append((nr, nc))
            nr += dr; nc += dc

    if pt == 'P':
        d = -1 if pc == 'w' else 1
        s = 6 if pc == 'w' else 1
        if in_bounds(r+d, c) and not b[r+d][c]:
            moves.append((r+d, c))
            if r == s and not b[r+2*d][c]: moves.append((r+2*d, c))
        for dc in [-1, 1]:
            if in_bounds(r+d, c+dc):
                if b[r+d][c+dc] and col(b[r+d][c+dc]) != pc: moves.append((r+d, c+dc))
                if ep and (r+d, c+dc) == ep: moves.append((r+d, c+dc))

    if pt == 'N':
        for dr, dc in [(2,1),(2,-1),(-2,1),(-2,-1),(1,2),(1,-2),(-1,2),(-1,-2)]: add(r+dr, c+dc)
    if pt in ('B','Q'): slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1)
    if pt in ('R','Q'): slide(1,0); slide(-1,0); slide(0,1); slide(0,-1)
    if pt == 'K':
        for dr, dc in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]: add(r+dr, c+dc)

    return [(nr, nc) for nr, nc in moves if col(b[nr][nc]) != pc]

def is_attacked(b, r, c, by):
    for rr in range(8):
        for cc in range(8):
            if col(b[rr][cc]) == by:
                if (r, c) in raw_moves(b, rr, cc, None): return True
    return False

def find_king(b, pc):
    for r in range(8):
        for c in range(8):
            if b[r][c] == pc+'K': return (r, c)

def apply_move(b, r, c, nr, nc, ep):
    nb = [row[:] for row in b]
    nb[nr][nc] = nb[r][c]
    nb[r][c] = None
    if typ(nb[nr][nc]) == 'P' and ep and (nr, nc) == ep:
        nb[r][nc] = None
    return nb

def legal_moves(b, r, c, ep, cr):
    p = b[r][c]
    if not p: return []
    pc, pt = col(p), typ(p)
    moves = raw_moves(b, r, c, ep)

    if pt == 'K':
        row = 7 if pc == 'w' else 0
        if r == row and c == 4:
            k_ok  = cr[pc+'K']
            kr_ok = cr[pc+'KR']
            qr_ok = cr[pc+'QR']
            oc = opp(pc)
            if k_ok and kr_ok and not b[row][5] and not b[row][6] \
               and not is_attacked(b,row,4,oc) and not is_attacked(b,row,5,oc) and not is_attacked(b,row,6,oc):
                moves.append((row, 6))
            if k_ok and qr_ok and not b[row][3] and not b[row][2] and not b[row][1] \
               and not is_attacked(b,row,4,oc) and not is_attacked(b,row,3,oc) and not is_attacked(b,row,2,oc):
                moves.append((row, 2))

    result = []
    for nr, nc in moves:
        nb = apply_move(b, r, c, nr, nc, ep)
        if pt == 'K' and abs(nc - c) == 2:
            if nc == 6: nb[r][5] = nb[r][7]; nb[r][7] = None
            if nc == 2: nb[r][3] = nb[r][0]; nb[r][0] = None
        kr, kc = find_king(nb, pc)
        if not is_attacked(nb, kr, kc, opp(pc)):
            result.append((nr, nc))
    return result

def all_legal(b, pc, ep, cr):
    moves = []
    for r in range(8):
        for c in range(8):
            if col(b[r][c]) == pc:
                for m in legal_moves(b, r, c, ep, cr):
                    moves.append(((r,c), m))
    return moves


class ChessApp:
    def __init__(self, root):
        self.root = root
        self.root.title('Chess')
        self.root.resizable(False, False)
        self.sq_size = 72
        self.setup()
        self.build_ui()
        self.render()

    def setup(self):
        self.board = init_board()
        self.turn = 'w'
        self.selected = None
        self.hints = []
        self.last_move = None
        self.ep = None
        self.cr = {'wK':True,'wKR':True,'wQR':True,'bK':True,'bKR':True,'bQR':True}
        self.captured_w = []
        self.captured_b = []
        self.game_over = False

    def build_ui(self):
        self.root.configure(bg='#2B2B2B')

        top = tk.Frame(self.root, bg='#2B2B2B')
        top.pack(pady=(16,0))
        self.status_var = tk.StringVar(value='White to move')
        tk.Label(top, textvariable=self.status_var, font=('Helvetica', 14),
                 bg='#2B2B2B', fg='#CCCCCC').pack()

        mid = tk.Frame(self.root, bg='#2B2B2B')
        mid.pack(padx=20, pady=12)

        sz = self.sq_size
        self.canvas = tk.Canvas(mid, width=sz*8, height=sz*8, highlightthickness=0)
        self.canvas.pack(side='left')
        self.canvas.bind('<Button-1>', self.on_click)

        side = tk.Frame(mid, bg='#2B2B2B', padx=14)
        side.pack(side='left', fill='y')

        tk.Label(side, text='White', font=('Helvetica',12,'bold'),
                 bg='#2B2B2B', fg='#F0D9B5').pack(anchor='w', pady=(4,0))
        self.cap_b_var = tk.StringVar()
        tk.Label(side, textvariable=self.cap_b_var, font=('Helvetica',16),
                 bg='#2B2B2B', fg='#F0D9B5', wraplength=120, justify='left').pack(anchor='w')

        tk.Label(side, text='Black', font=('Helvetica',12,'bold'),
                 bg='#2B2B2B', fg='#B58863').pack(anchor='w', pady=(16,0))
        self.cap_w_var = tk.StringVar()
        tk.Label(side, textvariable=self.cap_w_var, font=('Helvetica',16),
                 bg='#2B2B2B', fg='#B58863', wraplength=120, justify='left').pack(anchor='w')

        tk.Button(side, text='New Game', command=self.new_game,
                  font=('Helvetica',11), bg='#444', fg='white',
                  relief='flat', padx=10, pady=6, cursor='hand2').pack(anchor='w', pady=(24,0))

    def render(self):
        sz = self.sq_size
        self.canvas.delete('all')
        for r in range(8):
            for c in range(8):
                x1, y1 = c*sz, r*sz
                x2, y2 = x1+sz, y1+sz
                base = LIGHT if (r+c)%2==0 else DARK

                if self.selected and self.selected == (r,c):
                    fill = SEL
                elif self.last_move and (r,c) in [(self.last_move[0],self.last_move[1]),(self.last_move[2],self.last_move[3])]:
                    fill = LAST
                elif (r,c) in self.hints:
                    fill = HINT
                else:
                    fill = base

                self.canvas.create_rectangle(x1,y1,x2,y2, fill=fill, outline='')

                if (r,c) in self.hints and not self.board[r][c]:
                    cx, cy = x1+sz//2, y1+sz//2
                    self.canvas.create_oval(cx-10,cy-10,cx+10,cy+10, fill='#00000033', outline='')

                p = self.board[r][c]
                if p:
                    fg = '#FFFFFF' if col(p)=='w' else '#1A1A1A'
                    self.canvas.create_text(x1+sz//2, y1+sz//2,
                        text=PIECES[p], font=('Helvetica', int(sz*0.6)),
                        fill=fg)

        self.cap_b_var.set(''.join(PIECES[p] for p in self.captured_b))
        self.cap_w_var.set(''.join(PIECES[p] for p in self.captured_w))

    def on_click(self, event):
        if self.game_over: return
        c = event.x // self.sq_size
        r = event.y // self.sq_size
        if not in_bounds(r, c): return

        if self.selected:
            sr, sc = self.selected
            if (r, c) in self.hints:
                self.do_move(sr, sc, r, c)
                return

        if self.board[r][c] and col(self.board[r][c]) == self.turn:
            self.selected = (r, c)
            self.hints = legal_moves(self.board, r, c, self.ep, self.cr)
        else:
            self.selected = None
            self.hints = []
        self.render()

    def do_move(self, r, c, nr, nc):
        p = self.board[r][c]
        pt, pc = typ(p), col(p)
        captured = self.board[nr][nc]

        if pt == 'P' and self.ep and (nr, nc) == self.ep:
            captured = self.board[r][nc]
            self.board[r][nc] = None

        if captured:
            (self.captured_b if pc=='w' else self.captured_w).append(captured)

        self.board[nr][nc] = p
        self.board[r][c] = None

        if pt == 'K':
            row = 7 if pc=='w' else 0
            if nc == 6: self.board[row][5]=self.board[row][7]; self.board[row][7]=None
            if nc == 2: self.board[row][3]=self.board[row][0]; self.board[row][0]=None
            self.cr[pc+'K']=False; self.cr[pc+'KR']=False; self.cr[pc+'QR']=False

        if pt == 'R':
            if r==7 and c==0: self.cr['wQR']=False
            if r==7 and c==7: self.cr['wKR']=False
            if r==0 and c==0: self.cr['bQR']=False
            if r==0 and c==7: self.cr['bKR']=False

        self.ep = ((r+nr)//2, c) if pt=='P' and abs(nr-r)==2 else None
        self.last_move = (r, c, nr, nc)
        self.selected = None
        self.hints = []

        if pt == 'P' and (nr == 0 or nr == 7):
            self.render()
            self.promote(pc, nr, nc)
            return

        self.turn = opp(pc)
        self.render()
        self.check_end()

    def promote(self, pc, nr, nc):
        win = tk.Toplevel(self.root)
        win.title('Promote pawn')
        win.resizable(False, False)
        win.grab_set()
        tk.Label(win, text='Choose piece:', font=('Helvetica',12)).pack(pady=(12,6))
        frame = tk.Frame(win)
        frame.pack(padx=20, pady=(0,16))
        for t in ['Q','R','B','N']:
            def choose(t=t):
                self.board[nr][nc] = pc+t
                win.destroy()
                self.turn = opp(pc)
                self.render()
                self.check_end()
            tk.Button(frame, text=PIECES[pc+t], font=('Helvetica',28),
                      width=2, command=choose).pack(side='left', padx=4)

    def check_end(self):
        moves = all_legal(self.board, self.turn, self.ep, self.cr)
        kr, kc = find_king(self.board, self.turn)
        in_check = is_attacked(self.board, kr, kc, opp(self.turn))
        name = 'White' if self.turn=='w' else 'Black'
        oname = 'Black' if self.turn=='w' else 'White'
        if not moves:
            self.game_over = True
            if in_check:
                self.status_var.set(f'Checkmate! {oname} wins 🎉')
                messagebox.showinfo('Game Over', f'Checkmate! {oname} wins!')
            else:
                self.status_var.set('Stalemate — draw!')
                messagebox.showinfo('Game Over', 'Stalemate — it\'s a draw!')
        elif in_check:
            self.status_var.set(f'{name} to move — Check!')
        else:
            self.status_var.set(f'{name} to move')

    def new_game(self):
        self.setup()
        self.status_var.set('White to move')
        self.render()


if __name__ == '__main__':
    root = tk.Tk()
    app = ChessApp(root)
    root.mainloop()